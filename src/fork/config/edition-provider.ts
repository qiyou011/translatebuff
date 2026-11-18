import type { Config } from "@/types/config/config"
import { currentEdition } from "@/fork/identity/edition"
import {
  GOOGLE_TRANSLATE_PROVIDER_ID,
  MICROSOFT_TRANSLATE_PROVIDER_ID,
} from "@/utils/constants/providers"

export const EDITION_TRANSLATE_PROVIDER_ID =
  currentEdition() === "cn" ? MICROSOFT_TRANSLATE_PROVIDER_ID : GOOGLE_TRANSLATE_PROVIDER_ID

/** Repair only absent selections on the storage snapshot, before schema validation. */
export function fillMissingTranslateProviderIds(config: Config): boolean {
  let changed = false
  for (const slot of [
    config?.pageTranslation,
    config?.inputTranslation,
    config?.videoSubtitles,
    config?.selectionToolbar?.features?.translate,
  ]) {
    if (
      slot &&
      typeof slot === "object" &&
      (slot.providerId === undefined || slot.providerId === null || slot.providerId === "")
    ) {
      slot.providerId = EDITION_TRANSLATE_PROVIDER_ID
      changed = true
    }
  }
  return changed
}
