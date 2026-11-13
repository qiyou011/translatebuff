// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { resolveFeatureConfig } from "@/fork/config/feature-config"
import { migrateFeatureConfig } from "@/fork/config/migration"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { executeInputTranslation } from "../execute-input-translation"

const send = vi.hoisted(() =>
  vi.fn<(...args: any[]) => Promise<string>>().mockResolvedValue("translated"),
)
vi.mock("@/utils/message", () => ({ sendMessage: send }))
vi.mock("@/utils/prompts/translate", () => ({
  getTranslatePrompt: async () => ({ systemPrompt: "system", prompt: "prompt" }),
}))
vi.mock("@/utils/glossary/active-matcher", () => ({
  resolveGlossaryTerms: async () => ({ terms: [], revision: 0 }),
}))
vi.mock("@/utils/glossary/analytics", () => ({ trackGlossaryUsed: () => {} }))

describe("actual input request cache identity", () => {
  it("distinguishes concrete targets, providers and conversation context while reusing identical requests", async () => {
    const { mainConfig, forkConfig } = migrateFeatureConfig(
      structuredClone(DEFAULT_CONFIG),
      undefined,
    )
    mainConfig.inputTranslation.toLang = "fra"
    mainConfig.inputTranslation.providerId = "openai-default"
    mainConfig.pageTranslation.enableAIContentAware = true
    const first = resolveFeatureConfig("input", mainConfig, forkConfig)
    await executeInputTranslation({
      text: "hello",
      source: "eng",
      snapshot: first,
      readContext: () => ({ webContent: "Chat A" }),
    })
    await executeInputTranslation({
      text: "hello",
      source: "eng",
      snapshot: first,
      readContext: () => ({ webContent: "Chat B" }),
    })
    mainConfig.inputTranslation.toLang = "deu"
    const next = resolveFeatureConfig("input", mainConfig, forkConfig)
    await executeInputTranslation({
      text: "hello",
      source: "eng",
      snapshot: next,
      readContext: () => ({ webContent: "Chat A" }),
    })
    mainConfig.inputTranslation.providerId = "google-translate-default"
    await executeInputTranslation({
      text: "hello",
      source: "eng",
      snapshot: resolveFeatureConfig("input", mainConfig, forkConfig),
    })
    await executeInputTranslation({
      text: "hello",
      source: "eng",
      snapshot: first,
      readContext: () => ({ webContent: "Chat A" }),
    })
    const hashes = send.mock.calls
      .filter(([name]) => name === "enqueueTranslateRequest")
      .map(([, data]) => data.hash)
    expect(new Set(hashes.slice(0, 4)).size).toBe(4)
    expect(hashes[4]).toBe(hashes[0])
  })
})
