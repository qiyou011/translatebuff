import { closestScope, scopedSession } from "./session"

export function whatsappSession(editor: HTMLElement) {
  const root = closestScope(editor, "#main")
  if (!root || !editor.closest("footer")) return null
  const identity = () => {
    // The peer component is stable across incoming/outgoing message IDs.
    const messageId = root.querySelector("[data-id]")?.getAttribute("data-id")
    const peer = messageId?.split("_").find((part) => part.includes("@"))
    return peer ?? root.querySelector("header [title]")?.getAttribute("title") ?? null
  }
  return scopedSession("whatsapp", editor, root, identity, () =>
    Array.from(root.querySelectorAll("[data-id] .selectable-text")),
  )
}
