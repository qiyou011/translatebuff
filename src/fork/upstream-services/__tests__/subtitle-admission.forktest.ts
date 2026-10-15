// @vitest-environment jsdom
import type { SubtitlesFetcher } from "@/utils/subtitles/fetchers/types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { setupVideoSummaryHandlers } from "@/entrypoints/background/video-summary"
import { mountSubtitlesSidebar } from "@/entrypoints/subtitles.content/renderer/mount-subtitles-sidebar"
import { UniversalVideoAdapter } from "@/entrypoints/subtitles.content/universal-adapter"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { requestAiSubtitles } from "@/utils/subtitles/ai/request-ai-subtitles"
import { NetflixSubtitlesFetcher } from "@/utils/subtitles/fetchers/netflix"
import { requestVideoSummary } from "@/utils/subtitles/video-summary"

const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, () => Promise<unknown>>() }))
vi.mock("@/utils/message", () => ({
  onMessage: (name: string, handler: () => Promise<unknown>) => handlers.set(name, handler),
  sendMessage: vi
    .fn<(...args: unknown[]) => Promise<never>>()
    .mockRejectedValue(new Error("Unexpected background request")),
}))

beforeEach(() => handlers.clear())

describe("real redirected subtitle boundaries", () => {
  it("does not mount a sidebar host or even read the adapter", () => {
    const forbidden = new Proxy(
      {},
      {
        get() {
          throw new Error("Closed sidebar read adapter")
        },
      },
    )
    expect(() => mountSubtitlesSidebar(forbidden as never)).not.toThrow()
    expect(document.querySelector('[id*="subtitles-sidebar"]')).toBeNull()
  })

  it("preserves the native adapter while denying AI and sidebar operations", async () => {
    const native: SubtitlesFetcher = {
      fetch: async () => [],
      getSourceLanguage: () => "eng",
      isPreSegmented: () => true,
      hasAvailableSubtitles: async () => true,
      shouldUseSameTrack: async () => true,
      cleanup: () => {},
    }
    const aiFactory = vi.fn<() => SubtitlesFetcher>(() => native)
    const adapter = new UniversalVideoAdapter({
      config: {
        selectors: { video: "video", playerContainer: "body" },
        events: {},
        supportsSidebar: true,
      },
      fetchers: { native: () => native, ai: aiFactory },
    })
    expect(adapter.supportsAiSubtitles).toBe(false)
    expect(adapter.supportsSidebar).toBe(false)
    await expect(adapter.requestAiSubtitles()).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
    })
    await expect(adapter.generateVideoSummary(DEFAULT_CONFIG)).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
    })
    expect(aiFactory).not.toHaveBeenCalled()
  })

  it("rejects direct Netflix, AI and learning requests without opening background work", async () => {
    const netflix = new NetflixSubtitlesFetcher()
    expect(await netflix.hasAvailableSubtitles()).toBe(false)
    expect(await netflix.shouldUseSameTrack()).toBe(false)
    await expect(netflix.fetch()).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
      isRetryable: false,
    })
    netflix.cleanup()
    await expect(
      requestAiSubtitles({ videoId: "v", url: "https://youtube.com/watch?v=v", durationSec: 1 }),
    ).rejects.toMatchObject({ code: "UPSTREAM_CLOUD_DISABLED" })
    await expect(requestVideoSummary([], DEFAULT_CONFIG)).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
    })
  })

  it("settles direct background summary messages without reading or saving cached data", async () => {
    setupVideoSummaryHandlers()
    await expect(handlers.get("getCachedVideoSummary")?.()).resolves.toBeNull()
    await expect(handlers.get("saveVideoSummary")?.()).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
      isRetryable: false,
    })
  })
})
