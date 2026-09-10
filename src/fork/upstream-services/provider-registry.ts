import type { ProvidersConfig } from "@/types/config/provider"
import type {
  ProviderCapability,
  ProviderRefForCapability,
} from "@/utils/providers/provider-registry"
import { isRenyimiaoInstance } from "@/fork/providers/renyimiao-identity"
import {
  isLocalProviderConfigCompatibleWithCapability,
  resolveProviderRefForCapability as resolveUpstream,
} from "@/utils/providers/provider-registry"

export * from "@/utils/providers/provider-registry"

export function resolveProviderRefForCapability<C extends ProviderCapability>(
  capability: C,
  providersConfig: ProvidersConfig,
  providerId: string,
): ProviderRefForCapability<C> | null {
  const resolved = resolveUpstream(capability, providersConfig, providerId)
  if (!resolved || resolved.kind === "local") return resolved
  // 检测只允许本地降级；已关闭的笔记建议不能因兼容而恢复付费请求。
  if (capability === "languageDetection" || capability === "noteSuggestion") return null

  for (const provider of providersConfig) {
    if (
      provider.enabled &&
      isRenyimiaoInstance(provider) &&
      provider.provider === "openai-compatible" &&
      !!provider.apiKey &&
      isLocalProviderConfigCompatibleWithCapability(capability, provider)
    ) {
      return { kind: "local", config: provider, id: provider.id, name: provider.name }
    }
  }
  return null
}
