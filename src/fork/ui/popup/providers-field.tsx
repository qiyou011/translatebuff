import type { Config } from "@/types/config/config"
import type { ProvidersConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import type { ProviderCapability } from "@/utils/providers/provider-registry"
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import { useTheme } from "@/components/providers/theme-provider"
import { Avatar, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/base-ui/avatar"
import { Button } from "@/components/ui/base-ui/button"
import { Drawer, DrawerBody, DrawerContent, DrawerTrigger } from "@/components/ui/base-ui/drawer"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import ForkProviderSelector from "@/fork/components/provider-selector"
import { useEnsureRenyimiaoSeeded } from "@/fork/providers/use-ensure-renyimiao-seeded"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { getProviderLogo, getProviderName } from "@/utils/providers/provider-display"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"

// fork 换皮版 popup provider 块：忠实复刻上游 providers-field（summary + Drawer + 功能行 + 自定义动作行），
// 用 fork ProviderSelector + 逻辑函数 + base-ui 原语，不引用上游 composed UI。对齐现状：popup 不显示 api-key 警告。

const VISIBLE_PROVIDER_COUNT = 5

function getSelectedProviderOptions(
  config: Config,
  providersConfig: ProvidersConfig,
): ProviderSelectorOption[] {
  const selectedProviders: ProviderSelectorOption[] = []

  const addProvider = (capability: ProviderCapability, providerId: string) => {
    const selectedProvider = getSelectableProvidersForCapability(capability, providersConfig).find(
      (providerOption) => providerOption.id === providerId,
    )
    if (!selectedProvider) {
      return
    }
    selectedProviders.push(selectedProvider)
  }

  for (const featureKey of FEATURE_KEYS) {
    addProvider(featureKey, FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config))
  }
  for (const action of config.selectionToolbar.customActions) {
    if (action.enabled === false) {
      continue
    }
    addProvider("selectionToolbar.customAction", action.providerId)
  }

  return selectedProviders
}

function ProviderAvatarSummary({ providers }: { providers: ProviderSelectorOption[] }) {
  const { theme } = useTheme()
  const visibleProviders = providers.slice(0, VISIBLE_PROVIDER_COUNT)
  const remainingCount = providers.length - visibleProviders.length
  const providerKeyCounts = new Map<string, number>()

  return (
    <AvatarGroup>
      {visibleProviders.map((provider) => {
        const name = getProviderName(provider)
        const providerKeyCount = providerKeyCounts.get(provider.id) ?? 0
        providerKeyCounts.set(provider.id, providerKeyCount + 1)

        return (
          <Avatar
            key={`${provider.id}-${providerKeyCount}`}
            size="sm"
            className="items-center justify-center bg-white dark:bg-muted"
          >
            <AvatarImage
              src={getProviderLogo(provider, theme)}
              alt={name}
              className="size-3.5 rounded-none object-contain"
            />
          </Avatar>
        )
      })}
      {remainingCount > 0 && <AvatarGroupCount>{`+${remainingCount}`}</AvatarGroupCount>}
    </AvatarGroup>
  )
}

function FeatureRow({ featureKey }: { featureKey: FeatureKey }) {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config)
  const providers = useMemo(
    () => getSelectableProvidersForCapability(featureKey, providersConfig),
    [providersConfig, featureKey],
  )

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div className="flex flex-wrap" />}>
        {i18n.t(getFeatureLabelI18nKey(featureKey))}
      </FieldLabel>
      <ForkProviderSelector
        providers={providers}
        value={providerId}
        onChange={(id) => void setConfig(buildFeatureProviderPatch({ [featureKey]: id }))}
        className="w-full"
        triggerSize="sm"
      />
    </Field>
  )
}

function CustomActionRows() {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const customActionProviders = useMemo(
    () => getSelectableProvidersForCapability("selectionToolbar.customAction", providersConfig),
    [providersConfig],
  )
  const customActions = config.selectionToolbar.customActions.filter(
    (action) => action.enabled !== false,
  )

  if (customActions.length === 0) {
    return null
  }

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">
        {i18n.t("options.general.featureProviders.customActions")}
      </p>
      {customActions.map((action) => (
        <Field key={action.id}>
          <FieldLabel nativeLabel={false} render={<div />}>
            {action.name}
          </FieldLabel>
          <ForkProviderSelector
            providers={customActionProviders}
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
            className="w-full"
            triggerSize="sm"
            placeholder={i18n.t(
              "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.selectProvider",
            )}
          />
        </Field>
      ))}
    </>
  )
}

export default function ForkProvidersField() {
  const config = useAtomValue(configAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const selectedProviders = useMemo(
    () => getSelectedProviderOptions(config, providersConfig),
    [config, providersConfig],
  )

  // 挂载时幂等 seed 任译喵（读 storage 最新值，post-init 避竞态）+ repoint 被隐藏 provider 的功能/词典。
  useEnsureRenyimiaoSeeded()

  return (
    <Drawer>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-medium">
          {i18n.t("popup.providers.title")}
          <HelpTooltip>{i18n.t("popup.providers.description")}</HelpTooltip>
        </span>
        <DrawerTrigger
          render={
            <Button type="button" variant="ghost" aria-label={i18n.t("popup.providers.open")} />
          }
        >
          <ProviderAvatarSummary providers={selectedProviders} />
        </DrawerTrigger>
      </div>
      <DrawerContent>
        <DrawerBody className="p-4" data-base-ui-swipe-ignore="">
          <FieldGroup className="gap-4">
            {FEATURE_KEYS.map((featureKey) => (
              <FeatureRow key={featureKey} featureKey={featureKey} />
            ))}
            <CustomActionRows />
          </FieldGroup>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
