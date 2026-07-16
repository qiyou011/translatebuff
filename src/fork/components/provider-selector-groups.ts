import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { isRenyimiaoInstance } from "@/fork/providers/renyimiao"
import { isPureTranslateProviderConfig } from "@/types/config/provider"
import { isProviderSelectorItem } from "@/utils/providers/provider-display"

// fork 版选择器分组（锁定任译喵）：只保留「任译喵组（置顶）+ 普通翻译组」，
// 隐藏大语言模型组（OpenAI/DeepSeek/Atlas/自建）与内置模型组（免费AI）；空组过滤。
// 纯逻辑、React 无关，供 fork ProviderSelector 消费。

export type ForkProviderGroupKey = "renyimiao" | "normalTranslator"

export interface ForkProviderGroup {
  key: ForkProviderGroupKey
  providers: ProviderSelectorOption[]
}

export function getForkProviderSelectorGroups(
  providers: ProviderSelectorOption[],
): ForkProviderGroup[] {
  // normalTranslator 组直接从全量筛纯翻译 provider：isPureTranslateProviderConfig 只放行
  // microsoft/google，天然排除任译喵（openai-compatible），无需再预过滤任译喵。与上游同形。
  const groups: ForkProviderGroup[] = [
    { key: "renyimiao", providers: providers.filter(isRenyimiaoInstance) },
    {
      key: "normalTranslator",
      providers: providers.filter(
        (provider) => !isProviderSelectorItem(provider) && isPureTranslateProviderConfig(provider),
      ),
    },
  ]
  return groups.filter((group) => group.providers.length > 0)
}
