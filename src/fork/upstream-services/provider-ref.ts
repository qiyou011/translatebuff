import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { LLMProviderConfig, TranslateProviderConfig } from "@/types/config/provider"
import type {
  PromptableProviderRef,
  ProviderAvailability,
  SerializableProviderRef,
} from "@/utils/providers/provider-ref"
import type { ResolvedProviderRef } from "@/utils/providers/provider-registry"
import { getLocalConfig } from "@/utils/config/storage"
import { getHostedFeatureForRoute } from "@/utils/providers/provider-ref"
import { UpstreamCloudDisabledError } from "./disabled-error"
import { resolveProviderRefForCapability } from "./provider-registry"

export * from "@/utils/providers/provider-ref"

export function resolvePageTranslationProvider(
  config: Config,
): ResolvedProviderRef<TranslateProviderConfig> {
  const ref = resolveProviderRefForCapability(
    "pageTranslation",
    config.providersConfig,
    config.pageTranslation.providerId,
  )
  if (ref?.kind !== "local") throw new UpstreamCloudDisabledError()
  return ref
}

export function resolvePageTranslationProviderOrNull(
  config: Config,
): ResolvedProviderRef<TranslateProviderConfig> | null {
  try {
    return resolvePageTranslationProvider(config)
  } catch {
    return null
  }
}

export async function fetchHostedAiStatus(): Promise<undefined> {
  return undefined
}

export async function serializeProviderRef(
  provider: ResolvedProviderRef<LLMProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<PromptableProviderRef>
export async function serializeProviderRef(
  provider: ResolvedProviderRef<TranslateProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<SerializableProviderRef>
export async function serializeProviderRef(
  provider: ResolvedProviderRef<TranslateProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<SerializableProviderRef> {
  if (provider.kind === "local") return { kind: "local", config: provider.config }
  const config = await getLocalConfig()
  const ref = resolveProviderRefForCapability(
    getHostedFeatureForRoute(route),
    config?.providersConfig ?? [],
    provider.id,
  )
  if (ref?.kind !== "local") throw new UpstreamCloudDisabledError()
  return { kind: "local", config: ref.config }
}

export async function checkProviderAvailability(
  provider: ResolvedProviderRef<LLMProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<ProviderAvailability<PromptableProviderRef>>
export async function checkProviderAvailability(
  provider: ResolvedProviderRef<TranslateProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<ProviderAvailability>
export async function checkProviderAvailability(
  provider: ResolvedProviderRef<TranslateProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<ProviderAvailability> {
  try {
    return { available: true, providerRef: await serializeProviderRef(provider, route) }
  } catch (error) {
    if (error instanceof UpstreamCloudDisabledError)
      return { available: false, message: error.message }
    throw error
  }
}
