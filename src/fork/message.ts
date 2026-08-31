import { defineExtensionMessaging } from "@webext-core/messaging"

// fork 专属消息契约，独立于上游 ProtocolMap，避免同步冲突
interface ForkProtocolMap {
  forkPing: () => "pong"
  // 挂载补偿（R6）：popup/选项页挂载时若「已登录但 key 空」，请后台用会话凭据重取 tokens 并注入。
  forkEnsureMembershipKey: () => void
  // 挂载主动同步：popup/选项页挂载时请后台主动读官网现存 cookie，无会话则接管（有会话则后台短路）。
  forkSyncMembership: () => void
  // 本地登出：请后台确定性清态（清 session + key），不依赖 cookie 移除事件是否触发。
  forkClearMembership: () => void
  // 会员信息刷新：popup/选项页挂载时请后台用会话凭据重拉 tokens 重派生会员信息（用量动态，保证实时）。
  forkRefreshMembershipInfo: () => void
  // 翻译中心的活跃信号：该通路在页面内直调 executeTranslate、不发上游消息，故单开一条送到后台去重上报。
  forkReportTranslateActivity: () => void
}

export const { sendMessage: sendForkMessage, onMessage: onForkMessage } =
  defineExtensionMessaging<ForkProtocolMap>()
