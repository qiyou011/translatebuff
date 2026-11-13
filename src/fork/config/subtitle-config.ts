import type { FeatureConfigSnapshot } from "./types"
import { Sha256Hex } from "@/utils/hash"
import { readFeatureConfig } from "./storage"

/** Project independent subtitle languages onto the existing engine's request schema. */
export function projectSubtitleConfig(
  pair: Pick<FeatureConfigSnapshot, "mainConfig" | "forkConfig">,
) {
  const config = structuredClone(pair.mainConfig)
  config.language = { ...config.language, ...pair.forkConfig.featureLanguages.subtitles }
  return config
}

export async function readSubtitleConfig() {
  return projectSubtitleConfig(await readFeatureConfig())
}

export function subtitleConfigIdentity(pair: FeatureConfigSnapshot) {
  const config = projectSubtitleConfig(pair)
  return Sha256Hex(
    JSON.stringify({
      language: config.language,
      provider: config.providersConfig.find((p) => p.id === config.videoSubtitles.providerId),
      providerId: config.videoSubtitles.providerId,
      enabled: config.videoSubtitles.enabled,
      aiSegmentation: config.videoSubtitles.aiSegmentation,
      enableAIContentAware: config.pageTranslation.enableAIContentAware,
      glossary: config.glossary,
    }),
  )
}
