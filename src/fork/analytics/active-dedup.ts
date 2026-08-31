import { storage } from "#imports"

// 活跃事件按自然日去重：只存一个 UTC 的 YYYY-MM-DD，判定即字符串比较，跨零点自然失效。
//
// 为什么是 UTC 而不是用户本地时区：去重口径必须与中台看板的分桶时区一致。按本地时区的话每个
// 用户的「一天」边界都不同，任何固定时区的看板都对不齐——同一个 UTC+8 用户当天两次翻译可能
// 落进两个 UTC 日（双计），或两个本地日落进同一个 UTC 日（漏计）。海外线跨时区更明显。
// ⚠️ 若数据团队确认看板按北京时间分桶，把本函数换成 UTC+8 即可，其余逻辑不变。
//
// 存本地的代价是换设备 / 清数据 / 多 profile 会各自重新计一次当日活跃，服务端再按设备或账号去重。

const STORAGE_KEY = "local:forkActiveTracking" as const

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

export async function readLastReportedDate(): Promise<string | null> {
  return (await storage.getItem<string>(STORAGE_KEY)) ?? null
}

export async function writeLastReportedDate(dateKey: string): Promise<void> {
  await storage.setItem(STORAGE_KEY, dateKey)
}

export async function clearLastReportedDate(): Promise<void> {
  await storage.removeItem(STORAGE_KEY)
}
