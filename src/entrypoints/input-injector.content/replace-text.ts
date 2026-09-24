import {
  getTelegramSessionKey,
  TELEGRAM_DRAFT_VERSION_ATTR,
} from "@/fork/ui/selection-content/input-translation/telegram-context"
import { isDraftElement, replaceDraft } from "./editors/draft-js"
import { isSlateElement, replaceSlate } from "./editors/slate"

export function canReplaceTelegramDraft(
  request: {
    sessionKey?: string
    expectedUrl?: string
    expectedText?: string
    expectedVersion?: string
  },
  active: Element | null,
): boolean {
  if (!request.sessionKey) return true
  return (
    active instanceof HTMLElement &&
    request.expectedUrl === window.location.href &&
    getTelegramSessionKey(window.location.href, active) === request.sessionKey &&
    (active.innerText ?? active.textContent ?? "") === request.expectedText &&
    (active.getAttribute(TELEGRAM_DRAFT_VERSION_ATTR) ?? "0") === request.expectedVersion
  )
}

export function replaceText(text: string, notifyHost = false): boolean {
  const element = document.activeElement
  if (!element || !(element as HTMLElement).isContentEditable) return false

  if (isSlateElement(element)) return replaceSlate(element, text)

  if (isDraftElement(element)) return replaceDraft(element, text)

  return replaceFallback(element as HTMLElement, text, notifyHost)
}

function replaceFallback(element: HTMLElement, text: string, notifyHost: boolean): boolean {
  if (!notifyHost) {
    element.focus()
    document.execCommand("selectAll")
    return document.execCommand("insertText", false, text)
  }
  element.focus()
  let inputFired = false
  const onInput = () => {
    inputFired = true
  }
  element.addEventListener("input", onInput)
  let success: boolean
  try {
    document.execCommand("selectAll")
    success = document.execCommand("insertText", false, text)
  } finally {
    element.removeEventListener("input", onInput)
  }
  if (success && !inputFired) {
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }),
    )
  }
  return success
}
