import { closestScope, scopedSession } from "./session"

export function youtubeSession(editor: HTMLElement) {
  const root = closestScope(
    editor,
    "ytd-comment-thread-renderer, yt-live-chat-app, ytd-comment-simplebox-renderer",
  )
  if (!root) return null
  return scopedSession(
    "youtube",
    editor,
    root,
    () => window.location.href,
    () =>
      Array.from(
        root.querySelectorAll(
          "yt-live-chat-text-message-renderer #message, ytd-comment-view-model #content-text",
        ),
      ),
  )
}
