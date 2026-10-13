import { browser } from "#imports"
import { env } from "@/env"
import { onForkMessage, sendForkMessage } from "@/fork/message"
import { resolveChannelNumber } from "./channel"

const CHANNEL_COOKIE_NAME = "aitrans_cid"

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

/** 在后台其他网络模块启动前同步注册，国内和海外共用此入口。 */
export function setupInstallChannel(): void {
  onForkMessage("forkGetInstallChannel", () => getBackgroundInstallChannel())
}

/** 每次读取当前官网 Cookie；不消费旧版安装快照或推广记录。 */
export async function getBackgroundInstallChannel(): Promise<string> {
  const packageCid = resolveChannelNumber()
  try {
    const cookie = await timeout(
      browser.cookies.get({
        url: `${new URL(env.WXT_WEBSITE_URL).origin}/`,
        name: CHANNEL_COOKIE_NAME,
      }),
      null,
    )
    const cid = cookie?.value
    // eslint-disable-next-line no-control-regex -- UA 渠道段需排除控制字符。
    if (cid && !/[/\s\x00-\x1F\x7F]/.test(cid)) return cid
  } catch {
    // Cookie API、权限或环境不可用时使用包内号；后续请求重新读取。
  }
  return packageCid
}

/** popup/options 每次向后台询问，后台自己的请求直接读取 Cookie。 */
export async function getSelectedChannelNumber(): Promise<string> {
  if (typeof window === "undefined") return getBackgroundInstallChannel()
  try {
    const cid = await timeout<string | undefined>(
      sendForkMessage("forkGetInstallChannel").then((value) => value),
      undefined,
    )
    if (cid) return cid
  } catch {
    // 后台消息不可用时，在有 Cookie API 的扩展页面尝试直接读取。
  }
  return getBackgroundInstallChannel()
}
