import type { ComponentProps, ReactNode } from "react"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import { useAtomValue, useSetAtom } from "jotai"
import { Field, FieldGroup } from "@/components/ui/base-ui/field"
import ForkProviderSelector from "@/fork/components/provider-selector"
import { useEnsureRenyimiaoSeeded } from "@/fork/providers/use-ensure-renyimiao-seeded"
import {
  RenyimiaoGatedFallback,
  useRenyimiaoGatedProviders,
} from "@/fork/ui/providers/use-renyimiao-gating"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { isSystemProviderSelectorItem } from "@/utils/providers/provider-display"
import { providerSupportsTranslationOnlyMode } from "@/utils/providers/translation-only-gate"
import { cn } from "@/utils/styles/utils"

// fork 换皮版选项页「功能提供商」宿主：由 wxt.config resolve 重定向顶替上游 feature-provider-selector-list。
// 复刻上游结构（Field/FieldGroup/FieldLabel + props 面），选择器换 fork ForkProviderSelector；未登录/无 key 时
// 对任译喵施加与 popup 一致的门禁（共享 useRenyimiaoGatedProviders + RenyimiaoGatedFallback）。挂载时
// useEnsureRenyimiaoSeeded() 与 popup / 选项页「API 提供商」页对齐，堵首装直开「通用」页的门禁前置缺口。

type ProviderSelectorTriggerSize = ComponentProps<typeof ForkProviderSelector>["triggerSize"]

interface FeatureProviderSelectorListProps {
  className?: string
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
  includeCustomActions?: boolean
  renderApiKeyWarning?: (providerConfig: ProviderConfig | null) => ReactNode
}

function FeatureProviderField({
  featureKey,
  providerSelectorClassName,
  providerSelectorTriggerSize,
  renderApiKeyWarning,
}: {
  featureKey: FeatureKey
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
  renderApiKeyWarning?: (providerConfig: ProviderConfig | null) => ReactNode
}) {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config)
  const providerConfig = getProviderConfigById(providersConfig, providerId) ?? null
  const { providers, showFallback } = useRenyimiaoGatedProviders(featureKey, providerId)
  // 微软的免鉴权端点无保留标记模式，与仅译文组合会损坏页面（上游 v1.46.4 起自带该门禁，见 utils/providers/translation-only-gate）。
  // 判定放在这里而不是 ForkProviderSelector 内部：那个组件被 4 个上游 importer 共用，
  // 在里面按 mode 置灰会连带灰掉语言检测 / 自定义动作 / 划词工具栏的微软。
  const disabledProviderIds =
    featureKey === "pageTranslation" && config.pageTranslation.mode === "translationOnly"
      ? providers
          .filter(
            (provider) =>
              !isSystemProviderSelectorItem(provider) &&
              !providerSupportsTranslationOnlyMode(provider.provider),
          )
          .map((provider) => provider.id)
      : undefined

  return (
    <Field>
      {/* 上游 v1.46.4 把 FieldLabel 换成原生 Label（无 nativeLabel/render），
          这里只是不关联控件的标题行，直接用 div。 */}
      <div className="flex w-fit flex-wrap gap-2 text-sm leading-snug font-medium">
        {i18n.t(getFeatureLabelI18nKey(featureKey))}
        {/* 任译喵门禁（showFallback）时抑制上游缺 key 警告，改由下方登录引导承载；仅非任译喵缺 key 走上游警告。 */}
        {!showFallback && renderApiKeyWarning?.(providerConfig)}
      </div>
      {showFallback ? (
        <RenyimiaoGatedFallback />
      ) : (
        <ForkProviderSelector
          providers={providers}
          value={providerId}
          onChange={(id) => void setConfig(buildFeatureProviderPatch({ [featureKey]: id }))}
          className={providerSelectorClassName}
          triggerSize={providerSelectorTriggerSize}
          disabledProviderIds={disabledProviderIds}
        />
      )}
    </Field>
  )
}

function CustomActionProviderField({
  action,
  providerSelectorClassName,
  providerSelectorTriggerSize,
  renderApiKeyWarning,
}: {
  action: Config["selectionToolbar"]["customActions"][number]
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
  renderApiKeyWarning?: (providerConfig: ProviderConfig | null) => ReactNode
}) {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const currentProviderConfig = getProviderConfigById(providersConfig, action.providerId) ?? null
  const { providers, showFallback } = useRenyimiaoGatedProviders("customAction", action.providerId)

  return (
    <Field>
      <div className="flex w-fit flex-wrap gap-2 text-sm leading-snug font-medium">
        {action.name}
        {!showFallback && renderApiKeyWarning?.(currentProviderConfig)}
      </div>
      {showFallback ? (
        <RenyimiaoGatedFallback />
      ) : (
        <ForkProviderSelector
          providers={providers}
          value={action.providerId}
          onChange={(id) => {
            const updatedCustomActions = config.selectionToolbar.customActions.map((item) =>
              item.id === action.id ? { ...item, providerId: id } : item,
            )
            void setConfig({
              selectionToolbar: {
                ...config.selectionToolbar,
                customActions: updatedCustomActions,
              },
            })
          }}
          className={providerSelectorClassName}
          triggerSize={providerSelectorTriggerSize}
          placeholder={i18n.t("options.selectionToolbar.customActions.form.selectProvider")}
        />
      )}
    </Field>
  )
}

function CustomActionProviderFields({
  providerSelectorClassName,
  providerSelectorTriggerSize,
  renderApiKeyWarning,
}: {
  providerSelectorClassName?: string
  providerSelectorTriggerSize?: ProviderSelectorTriggerSize
  renderApiKeyWarning?: (providerConfig: ProviderConfig | null) => ReactNode
}) {
  const config = useAtomValue(configAtom)
  const customActions = config.selectionToolbar.customActions.filter(
    (action) => action.enabled !== false,
  )

  if (customActions.length === 0) {
    return null
  }

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">
        {i18n.t("options.selectionToolbar.customActions.title")}
      </p>
      {customActions.map((action) => (
        <CustomActionProviderField
          key={action.id}
          action={action}
          providerSelectorClassName={providerSelectorClassName}
          providerSelectorTriggerSize={providerSelectorTriggerSize}
          renderApiKeyWarning={renderApiKeyWarning}
        />
      ))}
    </>
  )
}

export function FeatureProviderSelectorList({
  className,
  providerSelectorClassName = "w-full",
  providerSelectorTriggerSize,
  includeCustomActions = true,
  renderApiKeyWarning,
}: FeatureProviderSelectorListProps) {
  // 与 popup / 选项页「API 提供商」页对齐：挂载时确保任译喵实例就位，门禁前置不缺失。
  useEnsureRenyimiaoSeeded()

  return (
    <FieldGroup className={cn("gap-4", className)}>
      {FEATURE_KEYS.map((featureKey) => (
        <FeatureProviderField
          key={featureKey}
          featureKey={featureKey}
          providerSelectorClassName={providerSelectorClassName}
          providerSelectorTriggerSize={providerSelectorTriggerSize}
          renderApiKeyWarning={renderApiKeyWarning}
        />
      ))}
      {includeCustomActions && (
        <CustomActionProviderFields
          providerSelectorClassName={providerSelectorClassName}
          providerSelectorTriggerSize={providerSelectorTriggerSize}
          renderApiKeyWarning={renderApiKeyWarning}
        />
      )}
    </FieldGroup>
  )
}
