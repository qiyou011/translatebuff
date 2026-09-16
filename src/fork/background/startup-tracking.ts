import { browser } from "#imports"
import { reportAppStartUp } from "@/fork/analytics/track-startup"

export function setupStartUpTracking(): void {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install" || reason === "update") {
      void reportAppStartUp(reason, Date.now())
    }
  })
  browser.runtime.onStartup.addListener(() => {
    void reportAppStartUp("startup", Date.now())
  })
}
