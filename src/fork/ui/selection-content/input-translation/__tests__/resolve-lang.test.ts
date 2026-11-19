// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { resolveInputTranslationLang } from "../resolve-lang"

const { pageLanguage } = vi.hoisted(() => ({
  pageLanguage: vi.fn<() => Promise<string>>(),
}))
vi.mock("@/utils/config/languages", () => ({ getDetectedCodeFromStorage: pageLanguage }))

const discordUrl = "https://discord.com/channels/1/2"

describe("input translation language resolution", () => {
  beforeEach(() => {
    pageLanguage.mockReset().mockResolvedValue("deu")
  })
  afterEach(() => document.body.replaceChildren())

  it.each([
    ["fra", "jpn", "fra"],
    ["targetCode", "jpn", "cmn"],
    ["sourceCode", "jpn", "jpn"],
  ] as const)("resolves the saved language option %s", async (option, sourceCode, expected) => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.language.sourceCode = sourceCode
    config.language.targetCode = "cmn"
    await expect(
      resolveInputTranslationLang(option, config, discordUrl, document.createElement("input")),
    ).resolves.toBe(expected)
    expect(pageLanguage).not.toHaveBeenCalled()
  })

  it("uses chat language first and falls back to the page language when chat has no result", async () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.language.sourceCode = "auto"
    document.body.innerHTML =
      '<li id="chat-messages-1"><div id="message-content-1">こんにちは</div></li><input />'
    const editor = document.querySelector("input")!
    await expect(
      resolveInputTranslationLang("sourceCode", config, discordUrl, editor),
    ).resolves.toBe("jpn")
    expect(pageLanguage).not.toHaveBeenCalled()

    document.querySelector("#message-content-1")!.textContent = "👍"
    await expect(
      resolveInputTranslationLang("sourceCode", config, discordUrl, editor),
    ).resolves.toBe("deu")
    expect(pageLanguage).toHaveBeenCalledOnce()
  })
})
