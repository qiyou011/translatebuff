import { afterEach, describe, expect, it, vi } from "vitest"
import { appendChannelId, resolveChannelNumber } from "../channel"
import channels from "../channels.json"

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
      resolveChannelNumber("pending", {
        pending: { number: null, browser: "chrome", edition: "cn" },
      }),
    ).toThrow(/未分配/)
  })
})

describe("resolveChannelNumber（edition 分区）", () => {
  it("global 线未注入渠道 id → 回落 global-zip 的号码 7150", () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    expect(resolveChannelNumber()).toBe("7150")
  })

  it("global 线四个渠道号码齐备", () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    expect(resolveChannelNumber("global-zip")).toBe("7150")
    expect(resolveChannelNumber("global-chrome-store")).toBe("7151")
    expect(resolveChannelNumber("global-edge")).toBe("7152")
    expect(resolveChannelNumber("global-firefox")).toBe("7153")
  })

  it("cn 线取 global 渠道 → 抛错并指明所属 edition，不返回其号码", () => {
    expect(() => resolveChannelNumber("global-chrome-store")).toThrow(/edition/)
  })

  it("global 线取 cn 渠道 → 抛错，防两线归因串味", () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    expect(() => resolveChannelNumber("chrome-store")).toThrow(/edition/)
  })
})

describe("channels.json 跨仓契约", () => {
  it("每个渠道号都落在官网 cid 放行的 71 段内（段外会被官网静默回落 7100）", () => {
    for (const [id, entry] of Object.entries(channels)) {
      if (entry.number === null) continue
      expect(entry.number, `渠道 ${id} 的号码超出官网放行段位`).toMatch(/^71\d{2}$/)
    }
  })

  it("每个渠道都显式登记 edition，不靠缺省猜", () => {
    for (const [id, entry] of Object.entries(channels)) {
      expect(["cn", "global"], `渠道 ${id} 缺少合法 edition`).toContain(entry.edition)
    }
  })

  it("渠道号在全表内唯一（撞号 = 两个来源记成同一个）", () => {
    const numbers = Object.values(channels)
      .map((entry) => entry.number)
      .filter((n): n is string => n !== null)
    expect(new Set(numbers).size).toBe(numbers.length)
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
