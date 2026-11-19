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
  ] as const)(
    "uses the saved source option %s and the separate input target",
    async (fromLang, sourceCode, source) => {
      const config = structuredClone(DEFAULT_CONFIG)
      config.language.sourceCode = sourceCode
      config.language.targetCode = "cmn"
      config.inputTranslation.fromLang = fromLang
      config.inputTranslation.toLang = "eng"
      await expect(
        resolveInputTranslationLang(config, discordUrl, document.createElement("input")),
      ).resolves.toEqual({
        from: { code: source },
        to: { code: "eng", source: "configured" },
      })
      expect(pageLanguage).not.toHaveBeenCalled()
    },
  )

  it("uses chat language first and falls back to the page language when chat has no result", async () => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.language.sourceCode = "auto"
    config.inputTranslation.fromLang = "sourceCode"
    config.inputTranslation.toLang = "eng"
    document.body.innerHTML =
      '<li id="chat-messages-1"><div id="message-content-1">こんにちは</div></li><input />'
    const editor = document.querySelector("input")!
    await expect(resolveInputTranslationLang(config, discordUrl, editor)).resolves.toMatchObject({
      from: { code: "jpn" },
      to: { code: "eng" },
    })
    expect(pageLanguage).not.toHaveBeenCalled()

    document.querySelector("#message-content-1")!.textContent = "👍"
    await expect(resolveInputTranslationLang(config, discordUrl, editor)).resolves.toMatchObject({
      from: { code: "deu" },
      to: { code: "eng" },
    })
    expect(pageLanguage).toHaveBeenCalledOnce()
  })
})
