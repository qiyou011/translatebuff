import { browser } from "#imports"
import { sendForkMessage } from "@/fork/message"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { sendMessage } from "@/utils/message"

/** Wait for the content manager to acknowledge the state; sending a message is not success. */
export async function requestPageTranslation(tabId: number, enabled: boolean, signal: AbortSignal) {
  signal.throwIfAborted()
  await sendMessage("tryToSetEnablePageTranslationByTabId", {
    tabId,
    enabled,
    analyticsContext: enabled
      ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.POPUP)
      : undefined,
  })
  for (let attempt = 0; attempt < 40; attempt++) {
    signal.throwIfAborted()
    const actual = await sendMessage("getEnablePageTranslationByTabId", { tabId })
    signal.throwIfAborted()
    if (actual === enabled) {
      if (!enabled) return false
      const frames = await browser.webNavigation.getAllFrames({ tabId })
      const frameIds = new Set([0, ...(frames ?? []).map((frame) => frame.frameId)])
      const results = await Promise.all(
        [...frameIds].map((frameId) =>
          sendForkMessage("forkGetPageTranslationStatus", undefined, { tabId, frameId })
            // A detached or restricted frame may have no content-script receiver.
            .catch(() => undefined),
        ),
      )
      signal.throwIfAborted()
      if (results.some((result) => result?.translated)) return true
      if (results.some((result) => result?.pending)) attempt = 0
      else if (results.some((result) => result?.failed)) {
        await sendMessage("tryToSetEnablePageTranslationByTabId", { tabId, enabled: false })
        throw new Error("Page translation failed")
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error("Page translation did not acknowledge the requested state")
}
