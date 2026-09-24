export interface TelegramContext {
  key: string
  messages: Element[]
}

export const TELEGRAM_DRAFT_VERSION_ATTR = "data-read-frog-input-version"

export function isTelegramUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === "web.telegram.org" && /^\/(a|k)\//.test(parsed.pathname)
  } catch {
    return false
  }
}

export function getTelegramSessionKey(url: string, editor: HTMLElement): string | null {
  if (!isTelegramUrl(url)) return null
  if (!editor.isContentEditable && editor.getAttribute("contenteditable") !== "true") return null
  if (new URL(url).pathname.startsWith("/a/") && editor.id === "editable-message-text") {
    if (editor.closest(".Composer")?.querySelector(".main-button.edit")) return null
    const lists = editor.closest(".MiddleColumn")?.querySelectorAll(".MessageList[data-list-key]")
    return lists?.length === 1
      ? `a:${lists[0]!.getAttribute("data-list-key")}:${new URL(url).hash}`
      : null
  }
  if (editor.matches(".input-message-input:not(.input-field-input-fake)")) {
    const composer = editor.closest(".chat-input")
    if (
      !composer ||
      composer.matches(".hide, .is-hidden") ||
      composer.querySelector(".btn-send.edit")
    )
      return null
    const lists = editor
      .closest(".chat.active")
      ?.querySelectorAll(".bubbles .bubbles-scrollable > .bubbles-inner")
    if (lists?.length !== 1) return null
    const list = lists[0] as HTMLElement
    const peerId = list
      .querySelector(".bubble[data-mid][data-peer-id]")
      ?.getAttribute("data-peer-id")
    list.dataset.readFrogInputSession ??= `${Date.now()}-${Math.random()}`
    return `k:${peerId ?? "empty"}:${new URL(url).hash}:${list.dataset.readFrogInputSession}`
  }
  return null
}

const NOISE =
  ".MessageMeta, .EmbeddedMessage, .code-title, .time, .peer-title, .reply, .read-frog-translated-content-wrapper, [data-read-frog-custom-translation-style]"

export function getTelegramContext(url: string, editor: HTMLElement): TelegramContext | null {
  let path: string
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "web.telegram.org") return null
    path = parsed.pathname
  } catch {
    return null
  }

  const key = getTelegramSessionKey(url, editor)
  if (!key) return null

  if (path.startsWith("/a/") && editor.id === "editable-message-text") {
    const column = editor.closest(".MiddleColumn")
    const lists = column?.querySelectorAll(".MessageList[data-list-key]")
    if (lists?.length !== 1) return null
    const list = lists[0]!
    if (!list.querySelector(".list-bottom-marker") || !isAtBottom(list)) return null
    return {
      key,
      messages: collectMessages(
        list,
        ".Message[data-message-id]",
        ".text-content",
        "data-message-id",
      ),
    }
  }

  if (
    path.startsWith("/k/") &&
    editor.matches(".input-message-input:not(.input-field-input-fake)")
  ) {
    const chat = editor.closest(".chat.active")
    const lists = chat?.querySelectorAll(".bubbles .bubbles-scrollable > .bubbles-inner")
    if (lists?.length !== 1) return null
    const list = lists[0]!
    if (!list.closest(".bubbles.scrolled-down")) return null
    return {
      key,
      messages: collectMessages(
        list,
        ".bubble[data-mid][data-peer-id]",
        ".message.spoilers-container",
        "data-mid",
      ),
    }
  }

  return null
}

function isAtBottom(element: Element): boolean {
  return (
    element.scrollHeight <= element.clientHeight ||
    element.scrollHeight - element.scrollTop - element.clientHeight < 40
  )
}

function collectMessages(
  list: Element,
  messageSelector: string,
  textSelector: string,
  idAttribute: string,
): Element[] {
  const seen = new Set<string>()
  const messages: Element[] = []
  for (const message of list.querySelectorAll(messageSelector)) {
    const id = message.getAttribute(idAttribute)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const body = message.querySelector(textSelector)
    if (!body) continue
    const clean = body.cloneNode(true) as Element
    clean.querySelectorAll(NOISE).forEach((node) => node.remove())
    if (clean.textContent?.trim()) messages.push(clean)
  }
  return messages
}
