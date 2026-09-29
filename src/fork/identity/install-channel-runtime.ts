import { browser } from "#imports"
import { env } from "@/env"
import { onForkMessage, sendForkMessage } from "@/fork/message"
import { resolveChannelNumber } from "./channel"
import { currentEdition } from "./edition"
import {
  createInstallChannelDecision,
  INSTALL_PROMOTION_COOKIE_NAME,
  readFixedChannel,
  type SavedInstallChannel,
} from "./install-channel"

const STORAGE_KEY = "fork_install_channel_v1"
let decision: ReturnType<typeof createInstallChannelDecision> | undefined

function timeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), 1500)
    void work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

function getDecision() {
  if (!decision) {
    const websiteUrl = new URL(env.WXT_WEBSITE_URL)
    decision = createInstallChannelDecision({
      packageCid: resolveChannelNumber(),
      websiteOrigin: websiteUrl.origin,
      readSaved: async () => {
        const result = await timeout(browser.storage.local.get(STORAGE_KEY), {})
        return result[STORAGE_KEY]
      },
      writeSaved: async (record: SavedInstallChannel) => {
        const saved = await timeout(
          browser.storage.local.set({ [STORAGE_KEY]: record }).then(() => true),
          false,
        )
        if (!saved) throw new Error("Install channel storage write unavailable")
      },
      readCookie: async () => {
        const cookie = await timeout(
          browser.cookies.get({
            url: `${websiteUrl.origin}/`,
            name: INSTALL_PROMOTION_COOKIE_NAME,
          }),
          null,
        )
        return cookie?.value ?? null
      },
    })
  }
  return decision
}

/** 在后台其他网络模块启动前同步注册。 */
export function setupInstallChannel(): void {
  if (currentEdition() !== "global") return
  getDecision()
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
      const installAt = Date.now()
      void getDecision().install(installAt)
    }
  })
  onForkMessage("forkGetInstallChannel", () => getBackgroundInstallChannel())
}

export async function getBackgroundInstallChannel(): Promise<string> {
  return currentEdition() === "global" ? getDecision().get() : resolveChannelNumber()
}

/** popup/options 向后台询问，后台自己的请求直接等待同一决策。 */
export async function getSelectedChannelNumber(): Promise<string> {
  if (currentEdition() !== "global") return resolveChannelNumber()
  if (typeof window === "undefined") return getBackgroundInstallChannel()
  try {
    return await sendForkMessage("forkGetInstallChannel")
  } catch {
    // 后台消息偶发不可用时先读已固定结果，避免回跳退回包内号。
    try {
      const saved = await timeout(browser.storage.local.get(STORAGE_KEY), {})
      const fixed = readFixedChannel(
        saved[STORAGE_KEY],
        resolveChannelNumber(),
        new URL(env.WXT_WEBSITE_URL).origin,
      )
      if (fixed) return fixed
    } catch {
      // 存储也不可用时才用包内号；不覆盖未知旧值。
    }
    return resolveChannelNumber()
  }
}
