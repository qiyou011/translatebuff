import { defineExtensionMessaging } from "@webext-core/messaging"

// fork 专属消息契约，独立于上游 ProtocolMap，避免同步冲突
interface ForkProtocolMap {
  forkPing: () => "pong"
}

export const { sendMessage: sendForkMessage, onMessage: onForkMessage } =
  defineExtensionMessaging<ForkProtocolMap>()
