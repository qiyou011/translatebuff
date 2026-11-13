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
    if (actual === enabled) return actual
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error("Page translation did not acknowledge the requested state")
}
