import { defineContentScript } from "#imports"
import { FORK_UPSTREAM_ADMISSION } from "@/fork/upstream-admission"
import { listenForSubtitlesRequests } from "./player"
import { setupTtmlCapture } from "./ttml-capture"

export default defineContentScript({
  matches: ["*://www.netflix.com/*"],
  excludeMatches: FORK_UPSTREAM_ADMISSION.netflixSubtitles ? [] : ["*://www.netflix.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    if (!FORK_UPSTREAM_ADMISSION.netflixSubtitles) return
    if ((window as any).__READ_FROG_NETFLIX_INTERCEPTOR_INJECTED__) {
      return
    }
    ;(window as any).__READ_FROG_NETFLIX_INTERCEPTOR_INJECTED__ = true

    setupTtmlCapture()
    listenForSubtitlesRequests()
  },
})
