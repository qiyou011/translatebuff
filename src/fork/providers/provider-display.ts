import type { Theme } from "@/types/config/theme"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { FORK_BRANDING } from "@/fork/branding"
import { isRenyimiaoInstance } from "@/fork/providers/renyimiao-identity"
import { getForkModelLogo } from "@/fork/ui/provider-logo"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import { isSystemProviderSelectorItem } from "@/utils/providers/provider-display"

// 换皮：上游 src/utils/providers/provider-display.ts。
// 覆盖模型名称与图标展示，不改写持久化配置。任译喵的托管模型都是 openai-compatible 实例，上游会一律发
// openai-compatible 的通用图标，用户看不出实际用的是哪家模型。解析不出时回落上游。
export * from "@/utils/providers/provider-display"

export function getProviderName(provider: ProviderSelectorOption): string {
  if (isSystemProviderSelectorItem(provider) || !isRenyimiaoInstance(provider)) return provider.name
  const prefix = [FORK_BRANDING.displayName, FORK_BRANDING.name]
    .map((brand) => `${brand} `)
    .find((brandPrefix) => provider.name.startsWith(brandPrefix))
  return prefix ? provider.name.slice(prefix.length) : provider.name
}

export function getProviderLogo(provider: ProviderSelectorOption, theme: Theme): string {
  if (isSystemProviderSelectorItem(provider)) {
    return provider.logo(theme)
  }

  return getForkModelLogo(provider, theme) ?? PROVIDER_ITEMS[provider.provider].logo(theme)
}
