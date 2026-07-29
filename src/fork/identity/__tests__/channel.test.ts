import { afterEach, describe, expect, it, vi } from "vitest"
import { appendChannelId, resolveChannelNumber } from "../channel"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("resolveChannelNumber（渠道号解析）", () => {
  it("未注入 WXT_FORK_CHANNEL → 回落默认渠道 zip 的号码 7100", () => {
    expect(resolveChannelNumber()).toBe("7100")
  })

  it("命中已分配渠道 → 返回其号码（zip/chrome-store/edge/firefox）", () => {
    expect(resolveChannelNumber("zip")).toBe("7100")
    expect(resolveChannelNumber("chrome-store")).toBe("7101")
    expect(resolveChannelNumber("edge")).toBe("7102")
    expect(resolveChannelNumber("firefox")).toBe("7103")
  })

  it("读构建期注入的 WXT_FORK_CHANNEL（stubEnv=chrome-store）→ 7101", () => {
    vi.stubEnv("WXT_FORK_CHANNEL", "chrome-store")
    expect(resolveChannelNumber()).toBe("7101")
  })

  it("未知渠道 id → 抛错且错误信息列出可选渠道", () => {
    expect(() => resolveChannelNumber("unknown-store")).toThrow(/zip/)
  })

  it("号码未分配（number=null，注入合成表）→ 抛错，不返回空串或占位", () => {
    expect(() =>
      resolveChannelNumber("pending", { pending: { number: null, browser: "chrome" } }),
    ).toThrow(/未分配/)
  })
})

describe("appendChannelId（官网链接盖渠道戳）", () => {
  it("无既有 query → 追加 ?cid=<号码>", () => {
    expect(appendChannelId("https://translatebuff.cn/login")).toBe(
      "https://translatebuff.cn/login?cid=7100",
    )
  })

  it("已有 query → 以 & 合并，只一个 ? 且不覆盖既有参数", () => {
    const out = appendChannelId("https://translatebuff.cn/login?lang=zh")
    expect(out).toContain("lang=zh")
    expect(out).toContain("cid=7100")
    expect(out.match(/\?/g)).toHaveLength(1)
  })

  it("含 fragment → cid 落在 fragment 之前（官网 location.search 才读得到）", () => {
    const out = appendChannelId("https://translatebuff.cn/#/uninstall-survey")
    expect(out.indexOf("cid=7100")).toBeLessThan(out.indexOf("#"))
  })
})
