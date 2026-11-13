import type { InputPlatformSession } from "./session"
import { getChatContextSelector } from "../chat-context-sites"
import { getTelegramContext, getTelegramSessionKey, isTelegramUrl } from "../telegram-context"
import { redditSession } from "./reddit"
import { closestScope, scopedSession } from "./session"
import { whatsappSession } from "./whatsapp"
import { xSession } from "./x"
import { youtubeSession } from "./youtube"

export function captureInputPlatformSession(editor: HTMLElement): InputPlatformSession | null {
  const url = window.location.href
  const host = new URL(url).hostname
  if (isTelegramUrl(url)) {
    const root = closestScope(editor, ".MiddleColumn, .chat.active")
    if (!root) return null
    return scopedSession(
      "telegram",
      editor,
      root,
      () => getTelegramSessionKey(window.location.href, editor),
      () => getTelegramContext(window.location.href, editor)?.messages ?? [],
    )
  }
  const selector = getChatContextSelector(url)
  if (selector) {
    const root = closestScope(editor, '[role="main"], main')
    if (!root) return null
    return scopedSession(
      "discord",
      editor,
      root,
      () => window.location.href,
      () =>
        root.querySelectorAll('[data-list-id="chat-messages"]').length > 1
          ? []
          : Array.from(root.querySelectorAll(selector)),
    )
  }
  if (host === "web.whatsapp.com") return whatsappSession(editor)
  if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com") return xSession(editor)
  if (host === "www.youtube.com" || host === "youtube.com") return youtubeSession(editor)
  if (host === "reddit.com" || host.endsWith(".reddit.com")) return redditSession(editor)
  return null
}
