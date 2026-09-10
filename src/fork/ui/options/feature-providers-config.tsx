import type { ReactNode } from "react"
import type { ProviderConfig, ProvidersConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import { useAtomValue } from "jotai"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { SetApiKeyWarning } from "@/components/llm-providers/set-api-key-warning"
import {
  useCustomActionProviders,
  useFeatureProvider,
} from "@/components/llm-providers/use-feature-providers"
import { ConfigItem } from "@/entrypoints/options/components/config-item"
import { ConfigSection } from "@/entrypoints/options/components/config-section"
import { SELECT_CONTENT_PROPS } from "@/entrypoints/options/components/select-content-props"
import { toSystemPromptPreview } from "@/entrypoints/options/pages/api-providers/feature-providers"
import { resolveProviderRefForCapability } from "@/fork/upstream-services/provider-registry"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  FEATURE_KEYS,
  getFeatureDescriptionI18nKey,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"

export { toSystemPromptPreview } from "@/entrypoints/options/pages/api-providers/feature-providers"

function ProviderTitle({
  children,
  providerConfig,
}: {
  children: ReactNode
  providerConfig: ProviderConfig | null
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {children}
      <SetApiKeyWarning providerConfig={providerConfig} />
    </span>
  )
}

function FeatureItem({
  featureKey,
  providersConfig,
}: {
  featureKey: FeatureKey
  providersConfig: ProvidersConfig
}) {
  const binding = useFeatureProvider(featureKey)
  const resolved = resolveProviderRefForCapability(featureKey, providersConfig, binding.providerId)
  return (
    <ConfigItem
      title={
        <ProviderTitle providerConfig={resolved?.kind === "local" ? resolved.config : null}>
          {i18n.t(getFeatureLabelI18nKey(featureKey))}
        </ProviderTitle>
      }
      description={i18n.t(getFeatureDescriptionI18nKey(featureKey))}
    >
      <ProviderSelector
        providers={binding.providers}
        value={resolved?.id ?? binding.providerId}
        onChange={binding.setProviderId}
        triggerSize="sm"
        selectContentProps={SELECT_CONTENT_PROPS}
      />
    </ConfigItem>
  )
}

function CustomActionItems({ providersConfig }: { providersConfig: ProvidersConfig }) {
  const { actions, providers, setActionProviderId } = useCustomActionProviders()
  return actions.map((action) => {
    const resolved = resolveProviderRefForCapability(
      "customAction",
      providersConfig,
      action.providerId,
    )
    return (
      <ConfigItem
        key={action.id}
        title={
          <ProviderTitle providerConfig={resolved?.kind === "local" ? resolved.config : null}>
            {action.name}
          </ProviderTitle>
        }
        description={toSystemPromptPreview(action)}
      >
        <ProviderSelector
          providers={providers}
          value={resolved?.id ?? action.providerId}
          onChange={(id) => setActionProviderId(action.id, id)}
          triggerSize="sm"
          selectContentProps={SELECT_CONTENT_PROPS}
          placeholder={i18n.t("options.selectionToolbar.customActions.form.selectProvider")}
        />
      </ConfigItem>
    )
  })
}

// 上游 API 提供商页已独立于 popup 的 selector list；只覆盖此设置区块，保留原布局、说明和配置写入。
export function FeatureProvidersConfig() {
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  return (
    <ConfigSection
      id="feature-providers"
      title={i18n.t("options.apiProviders.featureProviders.title")}
    >
      {FEATURE_KEYS.filter((key) => key !== "noteSuggestion").map((featureKey) => (
        <FeatureItem key={featureKey} featureKey={featureKey} providersConfig={providersConfig} />
      ))}
      <CustomActionItems providersConfig={providersConfig} />
    </ConfigSection>
  )
}
