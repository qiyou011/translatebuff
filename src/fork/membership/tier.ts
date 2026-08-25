// fork：会员信息派生。**逐字复刻官网 translatebuff-web/src/utils/credits.ts + format.ts 的 formatCredits**——
// 两仓各一份、无 git merge 关系；改官网 credits.ts / format.ts 须同步本文件（含 __tests__/tier.test.ts）。
// 会员类型是前端推断（官网不读后端 tier 字段）：主档订阅且未过期 → PRO。
// 后端契约常量（非本地约定）：token_name==="subscription"；expired_time=-1 视为永不过期。
// 精简说明：仅派生展示所需（tier / 到期 / 剩余额度），不复刻官网的总量·百分比·进度条（简洁展示不用）。

export const SUBSCRIPTION_TOKEN_NAME = "subscription"

// token 原始视图（后端 /v1/tokens 每条 token 的字段子集，全部可选）。
export interface RawToken {
  sk_key?: string
  token_name?: string
  expired_time?: number
  final_expire_at?: string
  remain_quota?: number
  priority?: number
}

export interface MembershipInfo {
  tier: "free" | "pro"
  expiryDate: string | null
  remainQuota: number
}

// 主档 = tokens 中 priority 最高的一条；priority 缺失按最低处理，相等取数组靠前；空/非数组返回 null。
export function pickPrimaryToken(tokens: RawToken[] | undefined): RawToken | null {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return null
  }
  return tokens.reduce((best, current) => {
    const bestPriority = Number.isFinite(best.priority)
      ? (best.priority as number)
      : Number.NEGATIVE_INFINITY
    const currentPriority = Number.isFinite(current.priority)
      ? (current.priority as number)
      : Number.NEGATIVE_INFINITY
    return currentPriority > bestPriority ? current : best
  })
}

// 剩余额度：取主档 remain_quota；无主档/缺失记 0，绝不抛错。
export function deriveCredits(tokens: RawToken[] | undefined): number {
  return Number(pickPrimaryToken(tokens)?.remain_quota) || 0
}

// 到期：取主档 final_expire_at 日期部分（"2027-07-24 18:34:03" → "2027-07-24"）；空/缺失/无主档 → null（隐藏到期行）。
export function derivePrimaryExpiry(tokens: RawToken[] | undefined): { date: string } | null {
  const finalExpireAt = pickPrimaryToken(tokens)?.final_expire_at
  if (typeof finalExpireAt !== "string" || finalExpireAt.trim() === "") {
    return null
  }
  return { date: finalExpireAt.split(" ")[0]! }
}

// 档位：主档为「有效订阅」才 PRO——token_name 为 subscription 且未过期（-1 视为永不过期）；
// 其余（已过期订阅 / 非订阅主档 / 无主档）判 free。nowSec 可注入以钉时间（快照语义，跨过到期不自动翻档）。
export function deriveTier(
  tokens: RawToken[] | undefined,
  nowSec: number = Date.now() / 1000,
): "free" | "pro" {
  const primary = pickPrimaryToken(tokens)
  if (!primary || primary.token_name !== SUBSCRIPTION_TOKEN_NAME) {
    return "free"
  }
  const expiredTime = primary.expired_time
  const active =
    expiredTime === -1 ||
    (typeof expiredTime === "number" && Number.isFinite(expiredTime) && expiredTime > nowSec)
  return active ? "pro" : "free"
}

// 组合派生：从 tokens 一次算出展示态（类型 / 到期 / 剩余额度）。
export function deriveMembershipInfo(
  tokens: RawToken[] | undefined,
  nowSec?: number,
): MembershipInfo {
  return {
    tier: deriveTier(tokens, nowSec),
    expiryDate: derivePrimaryExpiry(tokens)?.date ?? null,
    remainQuota: deriveCredits(tokens),
  }
}

function scaledUnit(value: number, unit: string): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}${unit}`
}

// 额度按量级选单位：不满千原样，千级 K，百万级及以上 M（保留 1 位小数）。
export function formatCredits(n: number): string {
  if (n < 1000) {
    return `${n}`
  }
  if (n < 1_000_000) {
    return scaledUnit(n / 1000, "K")
  }
  return scaledUnit(n / 1_000_000, "M")
}
