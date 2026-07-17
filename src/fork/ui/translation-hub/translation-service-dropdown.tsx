import { IconSettings } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { browser } from "#imports"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/base-ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { selectedProviderIdsAtom } from "@/entrypoints/translation-hub/atoms"
import { FORK_BRANDING } from "@/fork/branding"
import { isForkVisibleProvider, isRenyimiaoInstance } from "@/fork/providers/renyimiao"
import { isPureTranslateProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig, getTranslateProvidersConfig } from "@/utils/config/helpers"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import { i18n } from "@/utils/i18n"

// fork 换皮版多接口服务选择器：只列 fork 可见 provider（任译喵置顶组 + 普通翻译组），
// 隐藏默认 OpenAI/DeepSeek/Atlas 等 LLM。复用上游 base-ui Select 与 ProviderIcon，不引用上游 composed UI。
// 分组口径与 ForkProviderSelector 一致；选择状态走 fork atoms（默认亦只选可见项）。

// 任译喵组内去掉冗余的「任译喵 」前缀（组头已带品牌），平铺展示模型名；仅展示层，不改配置 name。
function stripBrandPrefix(name: string): string {
  const prefix = `${FORK_BRANDING.displayName} `
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

export function TranslationServiceDropdown() {
  const { theme } = useTheme()
  const [selectedIds, setSelectedIds] = useAtom(selectedProviderIdsAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const visibleProviders = filterEnabledProvidersConfig(
    getTranslateProvidersConfig(providersConfig),
  ).filter(isForkVisibleProvider)
  const renyimiaoProviders = visibleProviders.filter(isRenyimiaoInstance)
  const normalProviders = visibleProviders.filter(isPureTranslateProviderConfig)

  const handleConfigureAPI = async () => {
    try {
      await browser.tabs.create({
        url: browser.runtime.getURL("/options.html#/api-providers"),
      })
    } catch (error) {
      console.error("Error opening configure API:", error)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select multiple value={selectedIds} onValueChange={setSelectedIds}>
        <SelectTrigger className="min-w-52">
          <SelectValue placeholder={i18n.t("translateService.selectServices")}>
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2">
                <span>{i18n.t("translateService.translationProviders")}</span>
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                  {selectedIds.length}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {i18n.t("translateService.selectServices")}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {renyimiaoProviders.length > 0 && (
            <SelectGroup>
              <SelectLabel>{FORK_BRANDING.displayName}</SelectLabel>
              {renyimiaoProviders.map(({ id, name, provider }) => (
                <SelectItem key={id} value={id}>
                  <ProviderIcon
                    logo={PROVIDER_ITEMS[provider].logo(theme)}
                    name={stripBrandPrefix(name)}
                    size="sm"
                  />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {normalProviders.length > 0 && (
            <SelectGroup>
              <SelectLabel>{i18n.t("translateService.normalTranslator")}</SelectLabel>
              {normalProviders.map(({ id, name, provider }) => (
                <SelectItem key={id} value={id}>
                  <ProviderIcon logo={PROVIDER_ITEMS[provider].logo(theme)} name={name} size="sm" />
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={handleConfigureAPI}
        title={i18n.t("translateService.configureAPI")}
      >
        <IconSettings />
      </Button>
    </div>
  )
}
