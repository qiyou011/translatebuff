import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { TranslationTextFormat } from "@/types/config/translate"
import type { WebPagePromptContext } from "@/types/content"

export interface PageTranslationData {
  text: string
  langConfig: Config["language"]
  provider: ProviderConfig
  promptConfig: Config["pageTranslation"]["customPromptsConfig"]
  hash: string
  scheduleAt: number
  context?: WebPagePromptContext
  textFormat?: TranslationTextFormat
  preserveLineBreaks?: boolean
  scope?: string
  hostedFeature?: string
}
export type ItemOutcome = { ok: true; value: string } | { ok: false; error: Error }
