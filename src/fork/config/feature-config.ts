import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { ForkConfig } from "./schema"
import type { Config } from "@/types/config/config"
import { FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { Sha256Hex } from "@/utils/hash"
import { canResolvedProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"

const featureKeys = {
  page: "pageTranslation",
  selection: "selectionTranslation",
  input: "inputTranslation",
  subtitles: "videoSubtitles",
} as const
export type TranslationFeature = keyof typeof featureKeys

/** 只归一化配置；请求持有独立副本，后续 UI 改动不会改变在途参数。 */
export function resolveFeatureConfig(feature: TranslationFeature, main: Config, fork: ForkConfig) {
  const featureKey = featureKeys[feature]
  const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(main)
  const provider = resolveProviderRefForCapability(featureKey, main.providersConfig, providerId)
  if (!provider) throw new Error(`No ${feature} translation provider for id "${providerId}"`)
  let source: LangCodeISO6393 | "auto" | "auto-draft"
  let target: LangCodeISO6393
  if (feature === "input") {
    source = "auto-draft"
    const toLang = main.inputTranslation.toLang
    if (toLang === "sourceCode" || toLang === "targetCode")
      throw new Error("Input target has not been migrated")
    target = toLang
  } else {
    const language = feature === "page" ? main.language : fork.featureLanguages[feature]
    source = language.sourceCode
    target = language.targetCode
  }
  const snapshot = {
    feature,
    source,
    target,
    providerId,
    provider: structuredClone(provider),
    contextEnabled:
      (feature === "page" || feature === "input") &&
      main.pageTranslation.enableAIContentAware &&
      canResolvedProviderRefGenerateText(provider),
    level: main.language.level,
    glossaryEnabled: main.glossary.enabled,
    triggerCount: fork.inputTranslation.triggerCount,
  }
  return { ...snapshot, revision: Sha256Hex(JSON.stringify(snapshot), String(fork.revision)) }
}

export type FeatureSnapshot = ReturnType<typeof resolveFeatureConfig>
