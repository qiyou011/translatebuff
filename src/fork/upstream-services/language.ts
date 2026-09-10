import type { DetectLanguageOptions, DetectLanguageResult } from "@/utils/content/language"
import type { SerializableProviderRef } from "@/utils/providers/provider-ref"
import { getLocalConfig } from "@/utils/config/storage"
import {
  detectLanguageWithSource as detectUpstreamWithSource,
  detectLanguageWithLLM as detectUpstreamWithLLM,
} from "@/utils/content/language"
import { isBuiltInAiProviderId } from "./provider-registry"

export * from "@/utils/content/language"

async function usesUpstreamCloud(providerRef?: SerializableProviderRef): Promise<boolean> {
  if (providerRef) return providerRef.kind === "system"
  try {
    const config = await getLocalConfig()
    return isBuiltInAiProviderId(config?.languageDetection.providerId ?? "")
  } catch {
    // An unreadable provider choice must preserve local fallback without trying LLM services.
    return true
  }
}

export async function detectLanguageWithSource(
  text: string,
  options?: DetectLanguageOptions,
): Promise<DetectLanguageResult> {
  const disableLLM = options?.enableLLM && (await usesUpstreamCloud(options.providerRef))
  return detectUpstreamWithSource(text, disableLLM ? { ...options, enableLLM: false } : options)
}

export async function detectLanguage(text: string, options?: DetectLanguageOptions) {
  const result = await detectLanguageWithSource(text, options)
  return result.code === "und" ? null : result.code
}

export async function detectLanguageWithLLM(text: string, providerRef?: SerializableProviderRef) {
  if (await usesUpstreamCloud(providerRef)) return null
  return detectUpstreamWithLLM(text, providerRef)
}
