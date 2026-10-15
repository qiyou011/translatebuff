import type { ContentScriptContext } from "#imports"
import { FORK_UPSTREAM_ADMISSION } from "@/fork/upstream-admission"
import { initNetflixSubtitles } from "./init-netflix-subtitles"
import { initXcomSubtitles } from "./init-xcom-subtitles"
import { initYoutubeSubtitles } from "./init-youtube-subtitles"

let hasBootstrappedSubtitlesRuntime = false

export function bootstrapSubtitlesRuntime(ctx: ContentScriptContext) {
  if (hasBootstrappedSubtitlesRuntime) {
    return
  }

  hasBootstrappedSubtitlesRuntime = true
  initYoutubeSubtitles(ctx)
  if (FORK_UPSTREAM_ADMISSION.xSubtitles) initXcomSubtitles(ctx)
  if (FORK_UPSTREAM_ADMISSION.netflixSubtitles) initNetflixSubtitles(ctx)
}
