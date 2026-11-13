import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { resolveInputTranslationLang } from "../resolve-lang"
const { detect, pageLanguage } = vi.hoisted(() => ({
  detect: vi.fn<(...args: unknown[]) => Promise<string | null>>(),
  pageLanguage: vi.fn<() => Promise<string>>(),
}))
vi.mock("@/utils/content/language", () => ({ detectLanguage: detect }))
vi.mock("@/utils/config/languages", () => ({ getDetectedCodeFromStorage: pageLanguage }))

describe("input draft language resolution", () => {
  beforeEach(() => {
    detect.mockReset().mockResolvedValue("cmn")
    pageLanguage.mockReset()
  })
  it("detects only the draft and uses the configured concrete target", async () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.language = { ...config.language, sourceCode: "jpn", targetCode: "deu" }
    config.inputTranslation = {
      ...config.inputTranslation,
      fromLang: "fra",
      toLang: "eng",
      enableCycle: true,
    }
    await expect(resolveInputTranslationLang("这是当前输入的草稿", config)).resolves.toEqual({
      from: { code: "cmn", source: "draft" },
      to: { code: "eng", source: "configured" },
    })
    expect(detect).toHaveBeenCalledWith("这是当前输入的草稿", { enableLLM: false })
    expect(pageLanguage).not.toHaveBeenCalled()
  })
  it("fails without a page or chat fallback when detection has no result", async () => {
    detect.mockResolvedValue(null)
    const config = structuredClone(DEFAULT_CONFIG)
    config.inputTranslation.toLang = "eng"
    await expect(resolveInputTranslationLang("👍", config)).rejects.toThrow(
      "INPUT_LANGUAGE_UNDETECTED",
    )
    expect(pageLanguage).not.toHaveBeenCalled()
  })
  it("reports equal languages for the caller's no-request feedback", async () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.inputTranslation.toLang = "cmn"
    const pair = await resolveInputTranslationLang("这是一段中文草稿内容", config)
    expect(pair.from.code).toBe(pair.to.code)
  })
})
