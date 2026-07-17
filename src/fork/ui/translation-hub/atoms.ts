import type { TranslateProviderConfig } from "@/types/config/provider"
import { atom } from "jotai"
import { isForkVisibleProvider } from "@/fork/providers/renyimiao"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig, getTranslateProvidersConfig } from "@/utils/config/helpers"

// fork 换皮：translation-hub 的选择状态。wxt.config 把上游 atoms.ts 重定向到本模块，
// `export *` 复用上游全部 atom（守卫放行本模块 import 上游原版，避免自环），只覆盖下面两个：
// 上游默认「全选所有 enabled provider」会把默认 OpenAI/DeepSeek/Atlas 漏进多接口面板/下拉，
// 这里默认只选 fork 可见 provider（任译喵 + 纯翻译）。仅换默认值，override 后行为与上游一致。
export * from "@/entrypoints/translation-hub/atoms"

const selectedProviderIdsOverrideAtom = atom<string[] | null>(null)

export const selectedProviderIdsAtom = atom(
  (get) => {
    const override = get(selectedProviderIdsOverrideAtom)
    if (override !== null) return override
    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const translateProviders = getTranslateProvidersConfig(providersConfig)
    return filterEnabledProvidersConfig(translateProviders)
      .filter(isForkVisibleProvider)
      .map((provider) => provider.id)
  },
  (_get, set, ids: string[]) => set(selectedProviderIdsOverrideAtom, ids),
)

export const selectedProvidersAtom = atom((get) => {
  const ids = get(selectedProviderIdsAtom)
  const providersConfig = get(configFieldsAtomMap.providersConfig)
  return ids
    .map((id) => providersConfig.find((provider) => provider.id === id))
    .filter((provider): provider is TranslateProviderConfig => provider !== undefined)
})
