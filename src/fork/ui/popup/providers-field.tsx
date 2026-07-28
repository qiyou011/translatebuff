import type { Config } from "@/types/config/config"
import type { ProvidersConfig } from "@/types/config/provider"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import type { ProviderCapability } from "@/utils/providers/provider-registry"
import { IconLogin } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import { useTheme } from "@/components/providers/theme-provider"
import { Avatar, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/base-ui/avatar"
import { Button } from "@/components/ui/base-ui/button"
import { Drawer, DrawerBody, DrawerContent, DrawerTrigger } from "@/components/ui/base-ui/drawer"
import { forkSessionAtom, useOpenForkLogin } from "@/fork/membership/atoms"
import { useEnsureRenyimiaoSeeded } from "@/fork/providers/use-ensure-renyimiao-seeded"
import { FeatureProviderSelectorList } from "@/fork/ui/options/feature-provider-selector-list"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { getProviderLogo, getProviderName } from "@/utils/providers/provider-display"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"

// fork 换皮版 popup provider 块：抽屉体直接复用已门禁的 fork FeatureProviderSelectorList（隐藏不可用任译喵 +
// 无可选/选中即任译喵时改显登录引导），与选项页「通用」页共用同一份门禁宿主、单点维护。popup 特有的只有
// 折叠态头像 summary + Drawer + 顶部登录横幅。对齐现状：不传 renderApiKeyWarning，故 popup 不显 api-key 警告。

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

export default function ForkProvidersField() {
  const config = useAtomValue(configAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const selectedProviders = useMemo(
    () => getSelectedProviderOptions(config, providersConfig),
    [config, providersConfig],
  )
  const openLogin = useOpenForkLogin()
  // 只读会话态（生命周期由 ForkAccountMenu 的 useForkSession 持有并水合，本处只消费，避免重复订阅/补偿）。
  const session = useAtomValue(forkSessionAtom)

  // 挂载时幂等 seed 任译喵（读 storage 最新值，post-init 避竞态）+ repoint 被隐藏 provider 的功能/词典。
  // 抽屉体的 FeatureProviderSelectorList 亦会 seed，但那随抽屉挂载、可能晚于头像 summary，故此处保留 popup 挂载时的 seed。
  useEnsureRenyimiaoSeeded()

  // 登录引导条：仅未登录时展示（登录后即隐，不等 key 注入——避免"登录后仍显示登录引导"的矛盾）。
  const needsLogin = !session

  return (
    <>
      {needsLogin && (
        <button
          type="button"
          onClick={openLogin}
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <IconLogin className="size-4 shrink-0" aria-hidden />
          <span>登录后启用任译喵翻译</span>
        </button>
      )}
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
            <FeatureProviderSelectorList providerSelectorTriggerSize="sm" />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
