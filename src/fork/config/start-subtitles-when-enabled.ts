import type { FeatureConfigSnapshot } from "./types"
import { logger } from "@/utils/logger"
import { subscribeFeatureConfig } from "./storage"

/** A disabled page still watches settings so enabling subtitles does not need a reload. */
export function startSubtitlesWhenEnabled(start: () => Promise<void>) {
  let active = true
  let starting = false
  let started = false
  const unwatch = subscribeFeatureConfig(async (pair: FeatureConfigSnapshot) => {
    if (!active || starting || started || !pair.mainConfig.videoSubtitles.enabled) return
    starting = true
    try {
      await start()
      started = true
    } catch (error) {
      logger.warn("Unable to initialize subtitles", error)
    } finally {
      starting = false
    }
  })
  return () => {
    active = false
    unwatch()
  }
}
