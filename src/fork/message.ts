import { defineExtensionMessaging } from "@webext-core/messaging"

// fork 专属消息契约，独立于上游 ProtocolMap，避免同步冲突
interface ForkProtocolMap {
  forkPing: () => "pong"
  // 挂载补偿（R6）：popup/选项页挂载时若「已登录但 key 空」，请后台用会话凭据重取 tokens 并注入。
  forkEnsureMembershipKey: () => void
  // 本地登出：请后台确定性清态（清 session + key），不依赖 cookie 移除事件是否触发。
  forkClearMembership: () => void
}

export const { sendMessage: sendForkMessage, onMessage: onForkMessage } =
  defineExtensionMessaging<ForkProtocolMap>()
