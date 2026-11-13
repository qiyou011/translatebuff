import "@/utils/zod-config"
import { defineContentScript } from "#imports"
import { startSubtitlesWhenEnabled } from "@/fork/config/start-subtitles-when-enabled"
import { isApprovedSubtitlesUrl } from "@/fork/upstream-admission"
import { getLocalConfig } from "@/utils/config/storage"
import { initI18n } from "@/utils/i18n"
import { subtitlesContentScriptMatches } from "./content-script-matches"

declare global {
  interface Window {
    __READ_FROG_SUBTITLES_INJECTED__?: boolean
  }
}

export default defineContentScript({
  matches: subtitlesContentScriptMatches,
  allFrames: true,
  cssInjectionMode: "manifest",
  async main(ctx) {
    if (!isApprovedSubtitlesUrl(window.location.href)) return
    if (window.__READ_FROG_SUBTITLES_INJECTED__) return
    window.__READ_FROG_SUBTITLES_INJECTED__ = true

    const config = await getLocalConfig()
    await initI18n(config?.uiLanguage)

    ctx.onInvalidated(() => {
      window.__READ_FROG_SUBTITLES_INJECTED__ = false
    })

    const stopWatching = startSubtitlesWhenEnabled(async () => {
      const { bootstrapSubtitlesRuntime } = await import("./runtime")
      if (!ctx.isInvalid) bootstrapSubtitlesRuntime(ctx)
    })
    ctx.onInvalidated(stopWatching)
  },
})
