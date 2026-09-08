import { describe, expect, it } from "vitest"
import { getChatContextSelector } from "../chat-context-sites"

describe("getChatContextSelector", () => {
  it("Discord 频道页返回消息选择器", () => {
    expect(getChatContextSelector("https://discord.com/channels/123456/789012")).toBe(
      "li[id^=chat-messages] div[id^=message-content]",
    )
  })

  it("Discord 非频道页不启用（发现页、设置页没有对话）", () => {
    expect(getChatContextSelector("https://discord.com/discovery")).toBeNull()
    expect(getChatContextSelector("https://discord.com/")).toBeNull()
  })

  it("未登记的站点返回 null", () => {
    expect(getChatContextSelector("https://example.com/article")).toBeNull()
    expect(getChatContextSelector("https://github.com/foo/bar")).toBeNull()
  })

  it("非法 URL 返回 null 而不是抛错", () => {
    expect(getChatContextSelector("not a url")).toBeNull()
    expect(getChatContextSelector("")).toBeNull()
  })
})
