import type { ForkEdition } from "../identity/edition"
import { FORK_BRANDING, getForkDisplayName } from "../branding"

// WXT 的 manifest 文案不走运行时 i18next；仅处理生成资源的描述，不改变其他消息。
export function brandChromeMessages(contents: string, edition: ForkEdition): string {
  const messages = JSON.parse(contents)
  if (typeof messages.extDescription?.message === "string") {
    messages.extDescription.message = messages.extDescription.message
      .replaceAll(FORK_BRANDING.displayName, getForkDisplayName(edition))
      .replaceAll(FORK_BRANDING.name, getForkDisplayName(edition))
  }
  return JSON.stringify(messages)
}
