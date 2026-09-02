// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { resolveInputTranslationLang } from "../resolve-lang"

// 整页检测码来自 background，测试里不起消息通道；固定成日语，好和对话里的语种区分开。
const { mockGetDetectedCodeFromStorage } = vi.hoisted(() => ({
  mockGetDetectedCodeFromStorage: vi.fn<(...args: any[]) => any>(),
}))
vi.mock("@/utils/config/languages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/config/languages")>()),
  getDetectedCodeFromStorage: mockGetDetectedCodeFromStorage,
}))

const DISCORD_URL = "https://discord.com/channels/1/2"
const PLAIN_URL = "https://example.com/article"

const RUSSIAN_CHAT = [
  "Элис, еще раз добрый день! У меня появились срочные обстоятельства.",
  "Поэтому я смогу очень мало времени уделять стримам, к сожалению.",
]

function renderChat(messages: string[]) {
  document.body.innerHTML = messages
    .map(
      (text, index) =>
        `<li id="chat-messages-${index}"><div id="message-content-${index}">${text}</div></li>`,
    )
    .join("")
}

function configWith(language: Partial<Config["language"]>): Config {
  return { ...DEFAULT_CONFIG, language: { ...DEFAULT_CONFIG.language, ...language } }
}

describe("resolveInputTranslationLang", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    mockGetDetectedCodeFromStorage.mockReset()
    // 整页检测码固定为德语：只要结果不是 deu，就说明没走整页那条路。
    mockGetDetectedCodeFromStorage.mockResolvedValue("deu")
  })

  it("targetCode 直接取全局目标语言", async () => {
    const config = configWith({ targetCode: "cmn" })
    await expect(
      resolveInputTranslationLang("targetCode", config, DISCORD_URL, document),
    ).resolves.toEqual({ code: "cmn", source: "explicit" })
  })

  it("固定语言码原样返回", async () => {
    const config = configWith({})
    await expect(
      resolveInputTranslationLang("jpn", config, DISCORD_URL, document),
    ).resolves.toEqual({ code: "jpn", source: "explicit" })
  })

  it("源语言为自动、站点有对话时，跟随对话语种", async () => {
    renderChat(RUSSIAN_CHAT)
    const config = configWith({ sourceCode: "auto" })
    await expect(
      resolveInputTranslationLang("sourceCode", config, DISCORD_URL, document),
    ).resolves.toEqual({ code: "rus", source: "chatContext" })
  })

  it("源语言被用户钉死时，绝不被对话检测顶掉", async () => {
    // 页面上摆着俄语对话；结果必须是用户钉死的英语，而不是 rus。
    renderChat(RUSSIAN_CHAT)
    const config = configWith({ sourceCode: "eng" })
    await expect(
      resolveInputTranslationLang("sourceCode", config, DISCORD_URL, document),
    ).resolves.toEqual({ code: "eng", source: "explicit" })
  })

  it("对话判不出语种时回退整页源语言", async () => {
    renderChat(["👍", "🎉"])
    const config = configWith({ sourceCode: "auto" })
    await expect(
      resolveInputTranslationLang("sourceCode", config, DISCORD_URL, document),
    ).resolves.toEqual({ code: "deu", source: "pageSource" })
  })

  it("站点没登记对话选择器时走整页源语言", async () => {
    renderChat(RUSSIAN_CHAT)
    const config = configWith({ sourceCode: "auto" })
    await expect(
      resolveInputTranslationLang("sourceCode", config, PLAIN_URL, document),
    ).resolves.toEqual({ code: "deu", source: "pageSource" })
  })

  it("页面上没有任何消息时回退整页源语言", async () => {
    const config = configWith({ sourceCode: "auto" })
    await expect(
      resolveInputTranslationLang("sourceCode", config, DISCORD_URL, document),
    ).resolves.toEqual({ code: "deu", source: "pageSource" })
  })
})
