import { defineContentScript } from "#imports"
import {
  INPUT_REPLACE_REQUEST_TYPE,
  INPUT_REPLACE_RESULT_TYPE,
} from "@/utils/constants/input-injector"
import { getDeepActiveElement } from "@/utils/dom/active-element"
import { canReplaceTelegramDraft, replaceText } from "./replace-text"

export default defineContentScript({
  matches: ["*://*/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    if ((window as any).__READ_FROG_INPUT_INJECTOR__) return

    ;(window as any).__READ_FROG_INPUT_INJECTOR__ = true

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== INPUT_REPLACE_REQUEST_TYPE) return

      const success =
        canReplaceTelegramDraft(event.data, getDeepActiveElement()) &&
        replaceText(event.data.text, Boolean(event.data.sessionKey))
      if (typeof event.data.id === "string") {
        window.postMessage(
          { type: INPUT_REPLACE_RESULT_TYPE, id: event.data.id, success },
          window.location.origin,
        )
      }
    })
  },
})
