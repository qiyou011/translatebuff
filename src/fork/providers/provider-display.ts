import type { Theme } from "@/types/config/theme"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { getForkModelLogo } from "@/fork/ui/provider-logo"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import { isProviderSelectorItem } from "@/utils/providers/provider-display"

// 换皮：上游 src/utils/providers/provider-display.ts。
// 只覆盖 getProviderLogo —— 任译喵的托管模型都是 openai-compatible 实例，上游会一律发
// openai-compatible 的通用图标，用户看不出实际用的是哪家模型。解析不出时回落上游。
export * from "@/utils/providers/provider-display"

export function getProviderLogo(provider: ProviderSelectorOption, theme: Theme): string {
  if (isProviderSelectorItem(provider)) {
    return provider.logo(theme)
  }

  return getForkModelLogo(provider, theme) ?? PROVIDER_ITEMS[provider.provider].logo(theme)
}
