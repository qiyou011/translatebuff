import { toastManager } from "@/components/ui/base-ui/toast"
import { validateTranslationConfigAndToast as validateUpstream } from "@/utils/host/translate/translate-text"
import { UpstreamCloudDisabledError } from "./disabled-error"
import { isBuiltInAiProviderId, resolveProviderRefForCapability } from "./provider-registry"

export * from "@/utils/host/translate/translate-text"

export function validateTranslationConfigAndToast(
  config: Parameters<typeof validateUpstream>[0],
): boolean {
  if (
    isBuiltInAiProviderId(config.pageTranslation.providerId) &&
    !resolveProviderRefForCapability(
      "pageTranslation",
      config.providersConfig,
      config.pageTranslation.providerId,
    )
  ) {
    toastManager.add({
      type: "error",
      id: "fork-page-provider-unavailable",
      title: new UpstreamCloudDisabledError().message,
    })
    return false
  }
  return validateUpstream(config)
}
