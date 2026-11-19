import type { TranslateTextOptions } from "@/utils/host/translate/translate-text"
import { toastManager } from "@/components/ui/base-ui/toast"
import {
  translateTextCore as translateUpstream,
  validateTranslationConfigAndToast as validateUpstream,
} from "@/utils/host/translate/translate-text"
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

export function translateTextCore(options: TranslateTextOptions): Promise<string> {
  const { bilingualFormat, providerConfig, langConfig } = options
  if (
    bilingualFormat &&
    providerConfig.kind === "local" &&
    providerConfig.config.provider === "microsoft-translate" &&
    (langConfig.targetCode === "cmn" || langConfig.targetCode === "cmn-Hant") &&
    bilingualFormat.formats.some(({ id }) => /^[DH]/.test(id))
  ) {
    const pair = (["【】", "〈〉", "《》"] as const).find(
      (candidate) =>
        !options.text.includes(candidate.charAt(0)) && !options.text.includes(candidate.charAt(1)),
    )
    if (!pair) return translateUpstream(options)
    // The manifest keys both caches and follows this paragraph through batching.
    return translateUpstream({
      ...options,
      bilingualFormat: { ...bilingualFormat, microsoftRangeGuards: pair === "【】" ? true : pair },
    })
  }
  return translateUpstream(options)
}
