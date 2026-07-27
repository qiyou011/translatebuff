import { describe, expect, it } from "vitest"
import {
  deriveCredits,
  deriveMembershipInfo,
  derivePrimaryExpiry,
  deriveTier,
  formatCredits,
  pickPrimaryToken,
} from "../tier"

// 黄金用例逐字搬自官网 translatebuff-web/src/utils/credits.test.ts——tier.ts 复刻其派生逻辑，
// 二者语义须保持一致（改官网 credits.ts 须同步 tier.ts + 本测试）。

describe("pickPrimaryToken（priority 最高的主档）", () => {
  it("多条 token 取 priority 最高的一条", () => {
    expect(
      pickPrimaryToken([
        { priority: 1, token_name: "a" },
        { priority: 50, token_name: "b" },
      ])?.token_name,
    ).toBe("b")
  })

  it("priority 相等时取数组靠前一条", () => {
    expect(
      pickPrimaryToken([
        { priority: 5, token_name: "first" },
        { priority: 5, token_name: "second" },
      ])?.token_name,
    ).toBe("first")
  })

  it("priority 缺失的项不会盖过有 priority 的项", () => {
    expect(
      pickPrimaryToken([{ token_name: "no-prio" }, { priority: 1, token_name: "has-prio" }])
        ?.token_name,
    ).toBe("has-prio")
  })

  it("空数组 / undefined 返回 null，不抛错", () => {
    expect(pickPrimaryToken([])).toBeNull()
    expect(pickPrimaryToken(undefined)).toBeNull()
  })
})

describe("deriveCredits（主档剩余额度）", () => {
  it("取主档（priority 最高）的 remain_quota，不累加", () => {
    expect(
      deriveCredits([
        { priority: 1, remain_quota: 0 },
        { priority: 50, remain_quota: 1000 },
      ]),
    ).toBe(1000)
  })

  it("空 / undefined / 主档缺失 remain_quota → 0", () => {
    expect(deriveCredits([])).toBe(0)
    expect(deriveCredits(undefined)).toBe(0)
    expect(deriveCredits([{ priority: 1 }])).toBe(0)
  })
})

describe("derivePrimaryExpiry（主档到期日期）", () => {
  it("取主档 final_expire_at 日期部分", () => {
    expect(
      derivePrimaryExpiry([
        { priority: 1, final_expire_at: "2026-07-23 00:00:00" },
        { priority: 50, final_expire_at: "2027-07-24 18:34:03" },
      ]),
    ).toEqual({ date: "2027-07-24" })
  })

  it("空字符串 / 缺失 / 空数组 / undefined → null", () => {
    expect(derivePrimaryExpiry([{ priority: 50, final_expire_at: "" }])).toBeNull()
    expect(derivePrimaryExpiry([{ priority: 50 }])).toBeNull()
    expect(derivePrimaryExpiry([])).toBeNull()
    expect(derivePrimaryExpiry(undefined)).toBeNull()
  })
})

describe("deriveTier（主档订阅未过期判 pro）", () => {
  const NOW = 1_700_000_000

  it("未过期订阅主档 → pro", () => {
    expect(
      deriveTier([{ token_name: "subscription", priority: 50, expired_time: NOW + 1000 }], NOW),
    ).toBe("pro")
  })

  it("已过期订阅主档 → free", () => {
    expect(
      deriveTier([{ token_name: "subscription", priority: 50, expired_time: NOW - 1000 }], NOW),
    ).toBe("free")
  })

  it("订阅主档 expired_time=-1（永不过期）→ pro", () => {
    expect(deriveTier([{ token_name: "subscription", priority: 50, expired_time: -1 }], NOW)).toBe(
      "pro",
    )
  })

  it("订阅主档额度耗尽（remain=0）但未过期仍 → pro", () => {
    expect(
      deriveTier(
        [{ token_name: "subscription", priority: 50, remain_quota: 0, expired_time: NOW + 1000 }],
        NOW,
      ),
    ).toBe("pro")
  })

  it("非订阅主档 → free", () => {
    expect(
      deriveTier([{ token_name: "aitrans", priority: 50, expired_time: NOW + 1000 }], NOW),
    ).toBe("free")
  })

  it("空 / undefined → free", () => {
    expect(deriveTier([], NOW)).toBe("free")
    expect(deriveTier(undefined, NOW)).toBe("free")
  })

  it("过期订阅(prio50) + 生效标准版(prio1) → free（主档是过期订阅）", () => {
    expect(
      deriveTier(
        [
          { token_name: "subscription", priority: 50, expired_time: NOW - 86_400 },
          { token_name: "aitrans", priority: 1, expired_time: NOW + 86_400 },
        ],
        NOW,
      ),
    ).toBe("free")
  })
})

describe("deriveMembershipInfo（组合派生 → 展示态）", () => {
  const NOW = 1_700_000_000

  it("PRO 订阅：类型/到期/剩余量一并派生", () => {
    expect(
      deriveMembershipInfo(
        [
          {
            token_name: "subscription",
            priority: 50,
            expired_time: NOW + 1000,
            final_expire_at: "2027-07-24 18:34:03",
            remain_quota: 500,
          },
        ],
        NOW,
      ),
    ).toEqual({ tier: "pro", expiryDate: "2027-07-24", remainQuota: 500 })
  })

  it("空 tokens → free 默认（无到期、0 剩余）", () => {
    expect(deriveMembershipInfo([], NOW)).toEqual({
      tier: "free",
      expiryDate: null,
      remainQuota: 0,
    })
  })
})

describe("formatCredits（额度按量级选单位）", () => {
  it("不满千原样、千级 K、百万级 M", () => {
    expect(formatCredits(500)).toBe("500")
    expect(formatCredits(12_500)).toBe("12.5K")
    expect(formatCredits(1_500_000)).toBe("1.5M")
  })
})
