import type { BilingualFormatSource } from "../dom/bilingual-format"
import type { PageTranslationRequestOptions } from "../translate-variants"
import type { Config } from "@/types/config/config"
import { resolvePageTranslationProvider } from "@/utils/providers/provider-ref"
import {
  isBilingualFormatError,
  parseBilingualFormat,
  withoutBilingualFormatting,
} from "../bilingual-format-protocol"
import { renderBilingualFormat } from "../dom/bilingual-format"
import { translateTextForPage } from "../translate-variants"

export function usesBilingualFormat(config: Config): boolean {
  const provider = resolvePageTranslationProvider(config)
  return (
    config.pageTranslation.mode === "bilingual" &&
    provider.kind !== "system" &&
    ["google-translate", "microsoft-translate"].includes(provider.config.provider)
  )
}

export function createBilingualFormatRequest(
  source: BilingualFormatSource,
  options: PageTranslationRequestOptions,
) {
  let recovery = false
  return {
    sourceText: source.text,
    textFormat: "plain" as const,
    async translate(this: void): Promise<string> {
      try {
        const result = await translateTextForPage(source.text, "plain", {
          ...options,
          bilingualFormat: source.manifest,
        })
        if (result) parseBilingualFormat(result, source.manifest)
        return result
      } catch (error) {
        if (!isBilingualFormatError(error)) throw error
        recovery = true
        const manifest = { ...source.manifest, formats: [], recovery: true }
        const result = await translateTextForPage(
          withoutBilingualFormatting(source.text),
          "plain",
          {
            ...options,
            bilingualFormat: manifest,
          },
        )
        if (result) parseBilingualFormat(result, manifest)
        return result
      }
    },
    getDisplayText(result: string | undefined): string | undefined {
      return result === source.text ? "" : result
    },
    renderTranslatedContent(this: void, target: HTMLElement, text: string) {
      renderBilingualFormat(target, text, source, recovery)
    },
  }
}
