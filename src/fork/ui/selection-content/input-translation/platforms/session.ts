import type { WebPagePromptContext } from "@/types/content"

export interface InputPlatformSession {
  platform: string
  root: Element
  isCurrent: () => boolean
  readContext: () => WebPagePromptContext | undefined
}

export function closestScope(editor: HTMLElement, selector: string): Element | null {
  let node: Element | null = editor
  while (node) {
    const scope = node.closest(selector)
    if (scope) return scope
    const root: Node = node.getRootNode()
    node = root instanceof ShadowRoot ? root.host : null
  }
  return null
}

export function scopedSession(
  platform: string,
  editor: HTMLElement,
  root: Element,
  identity: () => string | null,
  messages: () => Element[],
): InputPlatformSession {
  const url = window.location.href
  const key = identity()
  const isCurrent = () =>
    editor.isConnected &&
    root.isConnected &&
    window.location.href === url &&
    key !== null &&
    identity() === key
  return {
    platform,
    root,
    isCurrent,
    readContext: () => {
      if (!isCurrent()) return undefined
      const text = messages()
        .slice(-5)
        .map((message) => {
          const clean = message.cloneNode(true) as Element
          clean
            .querySelectorAll(
              'script, style, input, textarea, [contenteditable], [aria-hidden="true"], time, .read-frog-translated-content-wrapper, [data-read-frog-custom-translation-style]',
            )
            .forEach((node) => node.remove())
          return clean.textContent?.trim().slice(0, 500) ?? ""
        })
        .filter(Boolean)
        .join("\n")
      return text ? { webContent: text } : undefined
    },
  }
}
