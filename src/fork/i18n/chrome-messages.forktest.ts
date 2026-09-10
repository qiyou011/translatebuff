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
