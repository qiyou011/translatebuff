import { browser } from "#imports"
import { reportTranslateActive } from "@/fork/analytics/track-active"
import { onForkMessage } from "@/fork/message"

// 翻译活跃信号的 background 接入点。三条通路里的两条走上游消息，但 @webext-core/messaging
// 每个 type 只允许注册一个 onMessage 监听器（重复注册会抛错），所以不能在上游的 handler 旁再挂一个。
//
// 改挂原生 runtime.onMessage 做被动观察：只读 message.type、**必须返回 undefined**——
// 返回 true 或 Promise 等于认领响应通道，上游 handler 的回复会被截走，表现为翻译永远拿不到结果。
//
// 第三条通路（翻译中心）在页面内直调 executeTranslate、不发上游消息，走 fork 消息进来。
// 选项页「连接测试」两条路都碰不到，天然不计为活跃行为。

/** 走 background 的翻译通路。新增翻译入口时必须同步补进来（有单测锁定本数组）。 */
export const TRANSLATE_ACTIVITY_MESSAGE_TYPES = [
  "enqueueTranslateRequest",
  "enqueueSubtitlesTranslateRequest",
] as const

function isTranslateActivityMessage(message: unknown): boolean {
  if (typeof message !== "object" || message === null) {
    return false
  }
  const type = (message as { type?: unknown }).type
  return (
    typeof type === "string" &&
    (TRANSLATE_ACTIVITY_MESSAGE_TYPES as readonly string[]).includes(type)
  )
}

export function setupTranslateActivity(): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isTranslateActivityMessage(message)) {
      void reportTranslateActive()
    }
    // 显式 undefined：绝不认领响应通道。
    return undefined
  })

  onForkMessage("forkReportTranslateActivity", () => {
    void reportTranslateActive()
  })
}
