import { closestScope, scopedSession } from "./session"

export function xSession(editor: HTMLElement) {
  // A reply dialog/form is a separate scope from the surrounding timeline.
  const root = closestScope(editor, '[role="dialog"], form, [data-testid="conversation"]')
  if (!root) return null
  return scopedSession(
    "x",
    editor,
    root,
    () => window.location.href,
    () =>
      Array.from(root.querySelectorAll('[data-testid="tweetText"], [data-testid="messageEntry"]')),
  )
}
