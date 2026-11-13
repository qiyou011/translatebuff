// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TranslatedSubtitlesDownloader } from "@/entrypoints/subtitles.content/translated-subtitles-downloader"
import { TranslationCoordinator } from "@/entrypoints/subtitles.content/translation-coordinator"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const mocks = vi.hoisted(() => ({
  translate: vi.fn<(...args: any[]) => Promise<any[]>>(),
  download: vi.fn<(...args: any[]) => Promise<void>>(),
}))
vi.mock("@/utils/subtitles/processor/translator", () => ({
  translateSubtitles: mocks.translate,
  resolveSubtitlesProviderRef: async () => null,
  fetchSubtitlesSummary: async () => null,
  buildSubtitlesSummaryContextHash: () => undefined,
}))
vi.mock("@/utils/subtitles/srt", () => ({ downloadSubtitlesAsSrt: mocks.download }))
vi.mock("@/utils/config/storage", async () => {
  const constants = await import("@/utils/constants/config")
  return { getLocalConfig: async () => structuredClone(constants.DEFAULT_CONFIG) }
})

describe("subtitle execution snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.translate.mockImplementation(async (fragments) =>
      fragments.map((f: object) => ({ ...f, translation: "Hallo" })),
    )
  })

  it("passes the captured subtitle target to the playback queue even if its owner changes", async () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.language.targetCode = "deu"
    const video = document.createElement("video")
    const onTranslated = vi.fn<() => void>()
    const coordinator = new TranslationCoordinator({
      configSnapshot: config,
      getFragments: () => [{ text: "hello", start: 0, end: 1000 }],
      getVideoElement: () => video,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated,
      onStateChange: vi.fn<() => void>(),
    })
    config.language.targetCode = "spa"
    coordinator.start()
    await vi.waitFor(() => expect(onTranslated).toHaveBeenCalled())
    expect(mocks.translate.mock.calls[0]?.[2]?.language.targetCode).toBe("deu")
    coordinator.stop()
  })

  it("exports using one injected subtitle snapshot and labels the actual output language", async () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.language.targetCode = "deu"
    config.videoSubtitles.aiSegmentation = false
    const readConfig = vi.fn<() => Promise<typeof config>>(async () => config)
    const downloader = new TranslatedSubtitlesDownloader(
      () => ({
        fetch: async () => [{ text: "hello", start: 0, end: 1000 }],
        getSourceLanguage: () => "en",
        isPreSegmented: () => true,
        shouldUseSameTrack: async () => true,
        hasAvailableSubtitles: async () => true,
        cleanup: () => {},
      }),
      { selectors: { video: "video", playerContainer: "body" }, events: {} },
      readConfig,
    )
    await downloader.download()
    expect(readConfig).toHaveBeenCalledOnce()
    expect(mocks.translate.mock.calls[0]?.[2]?.language.targetCode).toBe("deu")
    expect(mocks.download).toHaveBeenCalledWith(
      expect.objectContaining({ suffix: "translated-deu" }),
    )
    downloader.dispose()
  })

  it("retries failed cues with the captured language rather than a later global edit", async () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.language.targetCode = "deu"
    mocks.translate.mockRejectedValueOnce(new Error("temporary failure"))
    const video = document.createElement("video")
    const state = vi.fn<(...args: unknown[]) => void>()
    const translated = vi.fn<() => void>()
    const coordinator = new TranslationCoordinator({
      configSnapshot: config,
      getFragments: () => [{ text: "hello", start: 0, end: 1000 }],
      getVideoElement: () => video,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated: translated,
      onStateChange: state,
    })
    coordinator.start()
    await vi.waitFor(() => expect(state.mock.calls.some(([value]) => value === "error")).toBe(true))
    config.language.targetCode = "spa"
    coordinator.clearFailed()
    coordinator.requestTick()
    await vi.waitFor(() =>
      expect(translated).toHaveBeenLastCalledWith([
        expect.objectContaining({ translation: "Hallo" }),
      ]),
    )
    expect(mocks.translate.mock.calls.map((call) => call[2].language.targetCode)).toEqual([
      "deu",
      "deu",
    ])
    coordinator.stop()
  })
})
