import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type {
  ProviderAvailability,
  SerializableProviderRef,
  UnwrappedProviderRef,
} from "@/utils/providers/provider-ref"
import { getLocalConfig } from "@/utils/config/storage"
import { getHostedFeatureForRoute, isSystemProviderRef } from "@/utils/providers/provider-ref"
import { UpstreamCloudDisabledError } from "./disabled-error"
import { resolveProviderRefForCapability } from "./provider-registry"

export * from "@/utils/providers/provider-ref"

export function resolvePageTranslationProvider(config: Config): UnwrappedProviderRef {
  const ref = resolveProviderRefForCapability(
    "pageTranslation",
    config.providersConfig,
    config.pageTranslation.providerId,
  )
  if (ref?.kind !== "local") throw new UpstreamCloudDisabledError()
  return ref.config
}

export function resolvePageTranslationProviderOrNull(config: Config): UnwrappedProviderRef | null {
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
  provider: UnwrappedProviderRef,
  route: HostedAiTextStreamRoute,
): Promise<SerializableProviderRef> {
  if (!isSystemProviderRef(provider)) return { kind: "local", config: provider }
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
  provider: UnwrappedProviderRef,
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
