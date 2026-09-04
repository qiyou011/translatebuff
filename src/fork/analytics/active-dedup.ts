import { storage } from "#imports"

// 活跃事件按「身份 × UTC 自然日」去重：存一张 身份 → YYYY-MM-DD 的映射。
// 身份含游客与各个已登录账号——活跃口径本就包含未登录用户，同一台设备换账号也要各计一次。
//
// 为什么日期取 UTC 而不是用户本地时区：去重口径必须与中台看板的分桶时区一致。按本地时区的话每个
// 用户的「一天」边界都不同，任何固定时区的看板都对不齐——同一个 UTC+8 用户当天两次翻译可能
// 落进两个 UTC 日（双计），或两个本地日落进同一个 UTC 日（漏计）。海外线跨时区更明显。
// ⚠️ 若数据团队确认看板按北京时间分桶，把 toUtcDateKey 换成 UTC+8 即可，其余逻辑不变。
//
// 存本地的代价是换设备 / 清数据 / 多 profile 会各自重新计一次当日活跃，服务端再按账号去重。

const STORAGE_KEY = "local:forkActiveTracking" as const

/** 未登录用户的固定身份。活跃口径含游客，故它与各账号一样占一个桶。 */
export const ANONYMOUS_IDENTITY = "anon"

type ReportedDates = Record<string, string>

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/** UTC 自然日键。 */
export function toUtcDateKey(now: number): string {
  const date = new Date(now)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function shouldReportOn(todayKey: string, lastReported: string | null): boolean {
  return lastReported !== todayKey
}

// 旧格式存的是裸日期字符串，读到非对象一律当作无记录——不写兼容分支，代价只是升级当天
// 可能多报一次，后端会去重；换来的是不必长期养着一个只在升级日生效的分支。
async function readReportedDates(): Promise<ReportedDates> {
  const stored = await storage.getItem<unknown>(STORAGE_KEY)
  // typeof null 也是 "object"，得单独排掉，否则下面按键取值会抛。
  if (typeof stored !== "object" || stored === null) {
    return {}
  }
  return stored as ReportedDates
}

export async function readLastReportedDate(identity: string): Promise<string | null> {
  return (await readReportedDates())[identity] ?? null
}

// 写当日记录，同时丢弃非当日条目——键是账号标识，不清理会随设备上登录过的账号数无限增长。
export async function writeLastReportedDate(identity: string, dateKey: string): Promise<void> {
  const current = await readReportedDates()
  const sameDay = Object.entries(current).filter(([, value]) => value === dateKey)
  await storage.setItem(STORAGE_KEY, { ...Object.fromEntries(sameDay), [identity]: dateKey })
}

export async function clearLastReportedDate(): Promise<void> {
  await storage.removeItem(STORAGE_KEY)
}
