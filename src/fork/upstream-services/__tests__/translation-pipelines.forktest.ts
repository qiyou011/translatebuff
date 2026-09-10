// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { createStore } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toastManager } from "@/components/ui/base-ui/toast"
import { selectionToolbarTranslateRequestAtom } from "@/entrypoints/selection.content/selection-toolbar/atoms"
import { classifyResolvedProvider } from "@/utils/analytics-provider"
import { configAtom } from "@/utils/atoms/config"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { validateTranslationConfigAndToast } from "@/utils/host/translate/translate-text"
import {
  translateTextForInput,
  translateTextForPage,
} from "@/utils/host/translate/translate-variants"
import { sendMessage } from "@/utils/message"
import { fetchSubtitlesSummary, translateSubtitles } from "@/utils/subtitles/processor/translator"

vi.mock("@/utils/config/storage", () => ({ getLocalConfig: vi.fn<() => Promise<Config>>() }))
vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<(...args: unknown[]) => Promise<string>>().mockResolvedValue("translated"),
}))
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: vi.fn<(options: unknown) => void>() },
}))
// DOM context collection is outside this request-boundary test; prompts, hashing and resolution are real.
vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: async () => undefined,
}))
const candidate = {
  id: "renyimiao-pipeline",
  name: "Actual model",
  enabled: true,
  provider: "openai-compatible" as const,
  apiKey: "test-key",
  temperature: 0.35,
  baseURL: "https://gateway.example/v1",
  providerOptions: { testOption: true },
  model: { model: "use-custom-model" as const, isCustomModel: true, customModel: "actual-model" },
}
function legacyConfig(): Config {
  return {
    ...DEFAULT_CONFIG,
    providersConfig: [...DEFAULT_CONFIG.providersConfig, candidate],
    language: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode: "cmn" },
    pageTranslation: {
      ...DEFAULT_CONFIG.pageTranslation,
      providerId: "read-frog-free-ai",
      enableAIContentAware: false,
    },
    inputTranslation: { ...DEFAULT_CONFIG.inputTranslation, providerId: "read-frog-free-ai" },
    videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId: "read-frog-free-ai" },
    selectionToolbar: {
      ...DEFAULT_CONFIG.selectionToolbar,
      features: {
        ...DEFAULT_CONFIG.selectionToolbar.features,
        translate: {
          ...DEFAULT_CONFIG.selectionToolbar.features.translate,
          providerId: "read-frog-free-ai",
        },
      },
    },
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getLocalConfig).mockResolvedValue(legacyConfig())
})

describe("real translation pipelines with redirected registry", () => {
  it("gives guidance before starting a page with an unavailable legacy model", () => {
    const config = { ...legacyConfig(), providersConfig: [] }
    expect(validateTranslationConfigAndToast(config)).toBe(false)
    expect(toastManager.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Sign in.*select/) }),
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("does not mark unavailable legacy subtitle translation as a successful empty result", async () => {
    const config = { ...legacyConfig(), providersConfig: [] }
    await expect(
      translateSubtitles(
        [{ text: "Video", start: 0, end: 1 }],
        { videoTitle: "Video", subtitlesTextContent: "Video" },
        config,
      ),
    ).rejects.toMatchObject({ code: "UPSTREAM_CLOUD_DISABLED", isRetryable: false })
    expect(toastManager.add).toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })
  it("page and input dispatch actual model parameters and never ask for hosted state", async () => {
    await expect(
      translateTextForPage("Page pipeline unique text", "plain", { forceRetranslation: true }),
    ).resolves.toBe("translated")
    await expect(translateTextForInput("Input pipeline unique text", "eng", "cmn")).resolves.toBe(
      "translated",
    )
    expect(sendMessage).toHaveBeenCalledTimes(2)
    for (const call of vi.mocked(sendMessage).mock.calls) {
      expect(call).toEqual([
        "enqueueTranslateRequest",
        expect.objectContaining({
          providerRef: { kind: "local", config: candidate },
          hash: expect.any(String),
        }),
      ])
    }
  })

  it("subtitle translation and summary use the local model and model-specific cache identity", async () => {
    const config = legacyConfig()
    const context = { videoTitle: "Video", subtitlesTextContent: "Subtitle pipeline text" }
    const fragments = [{ text: context.subtitlesTextContent, start: 0, end: 1000 }]
    expect(await translateSubtitles(fragments, context, config)).toEqual([
      { ...fragments[0], translation: "translated" },
    ])
    const first = vi.mocked(sendMessage).mock.calls[0]
    expect(first).toEqual([
      "enqueueSubtitlesTranslateRequest",
      expect.objectContaining({ providerRef: { kind: "local", config: candidate } }),
    ])
    const changed = { ...candidate, model: { ...candidate.model, customModel: "different-model" } }
    await translateSubtitles(fragments, context, { ...config, providersConfig: [changed] })
    expect(vi.mocked(sendMessage).mock.calls[1]?.[1]).not.toEqual(first?.[1])
    await fetchSubtitlesSummary(context, {
      ...config,
      pageTranslation: { ...config.pageTranslation, enableAIContentAware: true },
    })
    expect(sendMessage).toHaveBeenLastCalledWith(
      "getSubtitlesSummary",
      expect.objectContaining({ providerRef: { kind: "local", config: candidate } }),
    )
    expect(sendMessage).toHaveBeenCalledTimes(3)
  })

  it("selection request and analytics agree with the effective provider without rewriting storage", () => {
    const config = legacyConfig()
    const store = createStore()
    store.set(configAtom, config)
    const request = store.get(selectionToolbarTranslateRequestAtom)
    expect(request.provider).toMatchObject({ kind: "local", id: candidate.id, config: candidate })
    expect(classifyResolvedProvider(request.provider)).toEqual({
      provider: "openai-compatible",
      backend_kind: "llm",
    })
    expect(store.get(configAtom)).toEqual(config)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
