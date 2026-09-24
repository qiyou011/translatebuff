import {
  INPUT_REPLACE_REQUEST_TYPE,
  INPUT_REPLACE_RESULT_TYPE,
} from "@/utils/constants/input-injector"
import { TELEGRAM_DRAFT_VERSION_ATTR } from "./telegram-context"

let nextId = 0

/** Wait for MAIN world to confirm the host editor accepted the replacement. */
export function replaceTelegramDraft(
  element: HTMLElement,
  text: string,
  sessionKey: string,
): Promise<boolean> {
  const id = `telegram-${++nextId}`
  const expectedText = element.innerText ?? element.textContent ?? ""
  const expectedUrl = window.location.href
  const expectedVersion = element.getAttribute(TELEGRAM_DRAFT_VERSION_ATTR) ?? "0"
  return new Promise((resolve) => {
    const finish = (success: boolean) => {
      window.clearTimeout(timeout)
      window.removeEventListener("message", onMessage)
      resolve(success && element.isConnected && (element.innerText ?? element.textContent) === text)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      if (event.data?.type !== INPUT_REPLACE_RESULT_TYPE || event.data.id !== id) return
      finish(event.data.success === true)
    }
    const timeout = window.setTimeout(() => finish(false), 1500)
    window.addEventListener("message", onMessage)
    element.focus()
    window.postMessage(
      {
        type: INPUT_REPLACE_REQUEST_TYPE,
        id,
        text,
        sessionKey,
        expectedText,
        expectedUrl,
        expectedVersion,
      },
      window.location.origin,
    )
  })
}
