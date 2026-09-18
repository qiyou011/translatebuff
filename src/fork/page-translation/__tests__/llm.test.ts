import type { PageTranslationData } from "../types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { buildPageLlmPrompt, requestPageLlm } from "../llm"

const mocks = vi.hoisted(() => ({
  generate: vi.fn<(...args: any[]) => any>(),
  model: vi.fn<(...args: any[]) => any>(() => "snapshot-model"),
}))
vi.mock("ai", () => ({ generateText: mocks.generate }))
vi.mock("@/utils/providers/model", () => ({ getLanguageModelForConfig: mocks.model }))

function data(): PageTranslationData {
  return {
    text: '<a data-rf-attr="0">Docs</a>',
    textFormat: "html",
    hash: "one",
    scheduleAt: 0,
    langConfig: { ...DEFAULT_CONFIG.language, targetCode: "cmn" },
    promptConfig: structuredClone(DEFAULT_CONFIG.pageTranslation.customPromptsConfig),
    provider: {
      id: "renyimiao-test",
      name: "test",
      provider: "openai-compatible",
      enabled: true,
      apiKey: "test-key",
      baseURL: "https://example.test/v1",
      model: { model: "use-custom-model", isCustomModel: true, customModel: "test-model" },
      providerOptions: { thinking: { type: "disabled" } },
      temperature: 0.3,
    },
  }
}
describe("page LLM boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generate.mockResolvedValue({ text: '{"t0":"ok"}' })
  })
  it.each([false, true])(
    "preserves formula instructions on the actual page prompt (individual=%s)",
    (individual) => {
      const item = { ...data(), text: "Formula {{0}}", textFormat: "plain" as const }
      const prompt = buildPageLlmPrompt([item], individual)
      expect(prompt.prompt).toContain("{{0}}")
      expect(prompt.systemPrompt).toContain("Protected Placeholder Rules")
      expect(prompt.systemPrompt).toContain("exactly once")
    },
  )
  it("default prompt sends compact object, preserves sentinel and does not send old marker block", () => {
    const prompt = buildPageLlmPrompt([data()])
    expect(prompt.structured).toBe(true)
    expect(prompt.prompt).toContain('"t0":"<a id=0>Docs</a>"')
    expect(prompt.systemPrompt).toContain("{{NO_TRANSLATION_NEEDED}}")
    expect(prompt.systemPrompt).not.toContain("data-rf-attr")
    expect(prompt.systemPrompt).not.toContain("{{targetLanguage}}")
  })
  it("keeps custom template and canonical marker input", () => {
    const item = data()
    item.promptConfig = {
      promptId: "user",
      patterns: [
        { id: "user", name: "mine", systemPrompt: "MY INSTRUCTIONS", prompt: "CUSTOM {{input}}" },
      ],
    }
    const prompt = buildPageLlmPrompt([item])
    expect(prompt.structured).toBe(false)
    expect(prompt.systemPrompt).toContain("MY INSTRUCTIONS")
    expect(prompt.prompt).toContain('CUSTOM <a data-rf-attr="0">Docs</a>')
  })
  it("uses captured provider, preserves options and adds only ephemeral gateway JSON mode", async () => {
    const item = data()
    const before = structuredClone(item)
    await requestPageLlm([item])
    expect(mocks.model).toHaveBeenCalledWith(item.provider)
    const options = mocks.generate.mock.calls[0]![0]
    expect(options.maxRetries).toBe(0)
    expect(options.temperature).toBe(0.3)
    expect(options.providerOptions["openai-compatible"]).toEqual({
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    })
    expect(item).toEqual(before)
  })
  it("does not parse broken model protocol inside the network invocation", async () => {
    mocks.generate.mockResolvedValue({ text: "not JSON" })
    expect(await requestPageLlm([data()])).toBe("not JSON")
  })
  it("does not turn authentication failure into a protocol fallback", async () => {
    const error = Object.assign(new Error("Unauthorized"), { statusCode: 401 })
    mocks.generate.mockRejectedValue(error)
    await expect(requestPageLlm([data()])).rejects.toBe(error)
  })
})
