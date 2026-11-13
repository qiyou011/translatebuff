import { beforeEach, describe, expect, it, vi } from "vitest"
import { resolveFeatureConfig } from "@/fork/config/feature-config"
import { migrateFeatureConfig } from "@/fork/config/migration"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { executeInputTranslation } from "../execute-input-translation"

const { translate } = vi.hoisted(() => ({
  translate: vi.fn<(...args: unknown[]) => Promise<string>>(),
}))
vi.mock("@/utils/host/translate/translate-text", () => ({ translateTextCore: translate }))

describe("input translation snapshot execution", () => {
  beforeEach(() => translate.mockReset().mockResolvedValue("translated"))
  it("passes the concrete pair, provider, glossary and newline contract to the existing engine", async () => {
    const { mainConfig, forkConfig } = migrateFeatureConfig(
      structuredClone(DEFAULT_CONFIG),
      undefined,
    )
    mainConfig.inputTranslation.toLang = "eng"
    const snapshot = resolveFeatureConfig("input", mainConfig, forkConfig)
    mainConfig.inputTranslation.toLang = "fra"
    const context = vi.fn<() => undefined>()
    await executeInputTranslation({
      text: "你好\n世界",
      source: "cmn",
      snapshot,
      readContext: context,
    })
    expect(translate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "你好\n世界",
        langConfig: { sourceCode: "cmn", targetCode: "eng", level: mainConfig.language.level },
        providerConfig: snapshot.provider,
        hostedFeature: "inputTranslation",
        glossaryEnabled: mainConfig.glossary.enabled,
        preserveLineBreaks: true,
        extraHashTags: ["inputTranslation:cmn->eng"],
      }),
    )
    expect(context).not.toHaveBeenCalled()
  })
  it("does not call the engine when the source and target are equal", async () => {
    const { mainConfig, forkConfig } = migrateFeatureConfig(
      structuredClone(DEFAULT_CONFIG),
      undefined,
    )
    mainConfig.inputTranslation.toLang = "eng"
    await expect(
      executeInputTranslation({
        text: "hello",
        source: "eng",
        snapshot: resolveFeatureConfig("input", mainConfig, forkConfig),
      }),
    ).resolves.toBe("")
    expect(translate).not.toHaveBeenCalled()
  })
  it("reads only the captured editor's context for a capable provider and forwards it to the cache-aware engine", async () => {
    const { mainConfig, forkConfig } = migrateFeatureConfig(
      structuredClone(DEFAULT_CONFIG),
      undefined,
    )
    mainConfig.inputTranslation.providerId = "openai-default"
    mainConfig.inputTranslation.toLang = "fra"
    mainConfig.pageTranslation.enableAIContentAware = true
    const snapshot = resolveFeatureConfig("input", mainConfig, forkConfig)
    const context = vi.fn<() => { webTitle: string; webContent: string }>(() => ({
      webTitle: "Current conversation",
      webContent: "Only this conversation",
    }))
    mainConfig.inputTranslation.providerId = "google-translate-default"
    await executeInputTranslation({ text: "hello", source: "eng", snapshot, readContext: context })
    expect(context).toHaveBeenCalledOnce()
    expect(translate).toHaveBeenCalledWith(
      expect.objectContaining({
        providerConfig: snapshot.provider,
        webPageContext: context.mock.results[0]?.value,
        enableAIContentAware: true,
        extraHashTags: ["inputTranslation:eng->fra"],
      }),
    )
  })
})
