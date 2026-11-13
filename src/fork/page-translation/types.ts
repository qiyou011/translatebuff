import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { TranslationTextFormat } from "@/types/config/translate"
import type { WebPagePromptContext } from "@/types/content"
import type { MatchedTerm } from "@/utils/glossary/types"
import type { BilingualFormatManifest } from "@/utils/host/translate/bilingual-format-protocol"

export interface PageTranslationData {
  text: string
  bilingualFormat?: BilingualFormatManifest
  langConfig: Config["language"]
  provider: ProviderConfig
  promptConfig: Config["pageTranslation"]["customPromptsConfig"]
  hash: string
  scheduleAt: number
  context?: WebPagePromptContext
  glossaryTerms?: readonly MatchedTerm[]
  glossaryRevision?: number
  textFormat?: TranslationTextFormat
  preserveLineBreaks?: boolean
  scope?: string
  hostedFeature?: string
}
export type ItemOutcome = { ok: true; value: string } | { ok: false; error: Error }
