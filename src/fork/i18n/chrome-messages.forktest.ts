import { describe, expect, it } from "vitest"
import { brandChromeMessages } from "./chrome-messages"

describe("浏览器管理页品牌", () => {
  it.each([
    ["global", "TranslateBuff"],
    ["cn", "任译喵"],
  ] as const)("%s 保留描述语言但统一发行品牌", (edition, brand) => {
    const messages = {
      extDescription: { message: "任译喵 / TranslateBuff 翻译扩展", description: "metadata" },
      untouched: { message: "https://example.com/TranslateBuff" },
    }
    const result = JSON.parse(brandChromeMessages(JSON.stringify(messages), edition))
    expect(result.extDescription).toEqual({
      message: `${brand} / ${brand} 翻译扩展`,
      description: "metadata",
    })
    expect(result.untouched).toEqual(messages.untouched)
  })
})

describe("商店简介按发行版与语言定点覆盖", () => {
  const chineseSummary =
    "使用 20+ AI 模型翻译网页、文本、消息和视频字幕。支持双语阅读、翻译对比和上下文理解。"
  const englishSummary =
    "Translate webpages, text, messages, and subtitles with 20+ AI models. Read bilingually, compare translations, and stay in context."
  const input = JSON.stringify({
    extDescription: { message: "任译喵 翻译扩展", description: "metadata" },
    untouched: { message: "https://example.com/TranslateBuff" },
  })

  it.each([
    ["cn", "zh_CN", chineseSummary],
    ["global", "en", englishSummary],
    ["global", "zh_CN", "TranslateBuff 翻译扩展"],
    ["global", "zh_TW", "TranslateBuff 翻译扩展"],
    ["cn", "en", "任译喵 翻译扩展"],
  ] as const)("%s + %s 使用目标或原本地化简介", (edition, locale, expected) => {
    const messages = JSON.parse(brandChromeMessages(input, edition, locale))
    expect(messages.extDescription).toEqual({ message: expected, description: "metadata" })
    expect(messages.untouched).toEqual({ message: "https://example.com/TranslateBuff" })
  })

  it("海外英文简介符合 manifest 的 132 字符限制", () => {
    expect(englishSummary.length).toBeLessThanOrEqual(132)
  })
})
