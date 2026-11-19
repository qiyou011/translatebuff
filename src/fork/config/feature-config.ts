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
export function resolveFeatureConfig(
  ...[feature, main, fork, inputLanguage]:
    | [
        feature: "input",
        main: Config,
        fork: ForkConfig,
        language: { sourceCode: LangCodeISO6393; targetCode: LangCodeISO6393 },
      ]
    | [feature: Exclude<TranslationFeature, "input">, main: Config, fork: ForkConfig]
) {
  const featureKey = featureKeys[feature]
  const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(main)
  const provider = resolveProviderRefForCapability(featureKey, main.providersConfig, providerId)
  if (!provider) throw new Error(`No ${feature} translation provider for id "${providerId}"`)
  const language =
    feature === "input"
      ? inputLanguage
      : feature === "page"
        ? main.language
        : fork.featureLanguages[feature]
  const snapshot = {
    feature,
    source: language.sourceCode,
    target: language.targetCode,
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
