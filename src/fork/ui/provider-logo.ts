import type { ProviderConfig } from "@/types/config/provider"
import type { Theme } from "@/types/config/theme"
import { getLobeIconsCDNUrlFn } from "@/utils/logo"

const RENYIMIAO_PROVIDER_ID_PREFIX = "renyimiao-"

const MODEL_LOGOS = [
  { matches: (modelId: string) => modelId.startsWith("deepseek"), slug: "deepseek-color" },
  { matches: (modelId: string) => modelId.startsWith("gpt"), slug: "openai" },
  { matches: (modelId: string) => modelId.startsWith("qwen"), slug: "qwen-color" },
] as const

/** Resolve the visible model brand for fork-hosted OpenAI-compatible providers. */
export function getForkModelLogo(provider: ProviderConfig, theme: Theme): string | undefined {
  if (
    provider.provider !== "openai-compatible" ||
    !provider.id.startsWith(RENYIMIAO_PROVIDER_ID_PREFIX)
  ) {
    return undefined
  }

  const modelId = provider.model.customModel?.trim().toLowerCase()
  if (!modelId) {
    return undefined
  }

  const modelLogo = MODEL_LOGOS.find(({ matches }) => matches(modelId))
  return modelLogo ? getLobeIconsCDNUrlFn(modelLogo.slug)(theme) : undefined
}
