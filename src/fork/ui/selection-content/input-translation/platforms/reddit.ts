import { closestScope, scopedSession } from "./session"

export function redditSession(editor: HTMLElement) {
  const root = closestScope(editor, "shreddit-comment, shreddit-post, form")
  if (!root) return null
  return scopedSession(
    "reddit",
    editor,
    root,
    () =>
      `${window.location.href}:${root.getAttribute("thingid") ?? root.getAttribute("id") ?? ""}`,
    () =>
      Array.from(root.querySelectorAll('shreddit-post-text-body, [slot="comment"]')).filter(
        (node) => !node.contains(editor),
      ),
  )
}
