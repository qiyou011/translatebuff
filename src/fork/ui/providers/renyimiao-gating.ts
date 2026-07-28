import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { isRenyimiaoInstance } from "@/fork/providers/renyimiao"

// 门禁纯逻辑（可测核心，刻意 i18n-free 以便单测）：无可用 key（空串）时过滤掉任译喵项；
// 过滤后为空、或当前选中的正是被隐藏的任译喵时改显引导（后者防"选中值不在过滤后列表"的孤儿 value
// 传进选择器）。仅展示层计算，不改配置。
export function computeRenyimiaoGating(
  allProviders: ProviderSelectorOption[],
  renyimiaoApiKeyValue: string,
  selectedId: string,
): { providers: ProviderSelectorOption[]; showFallback: boolean } {
  const gated = renyimiaoApiKeyValue === ""
  const providers = gated
    ? allProviders.filter((provider) => !isRenyimiaoInstance(provider))
    : allProviders
  const showFallback = gated && (providers.length === 0 || isRenyimiaoInstance({ id: selectedId }))
  return { providers, showFallback }
}
