import { browser } from "#imports"
import { env } from "@/env"

export interface ReportDeviceInfo {
  sn?: string
}

// 只合并并发读写，不永久缓存：用户清 Cookie 后，下次事件应重新读取。
let pending: Promise<ReportDeviceInfo> | undefined

async function readOrCreateDeviceInfo(): Promise<ReportDeviceInfo> {
  try {
    const url = env.WXT_OFFICIAL_SITE_ORIGINS[0]
    if (!url) return {}
    const name = "translatebuff_device_sn"
    const existing = await browser.cookies.get({ url, name })
    if (existing?.value) return { sn: existing.value }

    const value = crypto.randomUUID()
    const saved = await browser.cookies.set({
      url,
      name,
      value,
      path: "/",
      secure: new URL(url).protocol === "https:",
      httpOnly: true,
      sameSite: "lax",
      expirationDate: Date.now() / 1000 + 400 * 86400,
    })
    // Cookie 不可写时不能发送每次都变的临时标识。
    return saved?.value ? { sn: saved.value } : {}
  } catch {
    return {}
  }
}

export function getReportDeviceInfo(): Promise<ReportDeviceInfo> {
  pending ??= readOrCreateDeviceInfo().finally(() => {
    pending = undefined
  })
  return pending
}
