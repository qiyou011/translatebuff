import type { PageTranslationData } from "./types"
import { ISO6393_TO_6391 } from "@read-frog/definitions"
import { escapeText } from "entities"
import {
  prepareGoogleTranslation,
  requestGoogleTranslationBatch,
  restoreGoogleTranslation,
} from "@/utils/host/translate/api/google"
import { requestMicrosoftTranslationBatch } from "@/utils/host/translate/api/microsoft"
import { assertHtmlAttributeMarkerIntegrity } from "@/utils/host/translate/html-attribute-markers"
import { normalizeTranslationOutput } from "@/utils/host/translate/translation-output-normalization"
import { PageProtocolError } from "./wire"

export function isPageMt(data: PageTranslationData): boolean {
  return (
    data.provider.provider === "google-translate" ||
    data.provider.provider === "microsoft-translate"
  )
}

export function getMtItemBytes(data: PageTranslationData): number {
  const encoded =
    data.provider.provider === "google-translate"
      ? prepareGoogleTranslation(data.text, data).requestText
      : escapeText(data.text)
  return new TextEncoder().encode(JSON.stringify(encoded)).length + 1
}

export async function requestPageMt(
  items: PageTranslationData[],
  signal?: AbortSignal,
): Promise<unknown> {
  const first = items[0]!
  const from =
    first.langConfig.sourceCode === "auto"
      ? "auto"
      : (ISO6393_TO_6391[first.langConfig.sourceCode] ?? "auto")
  const to = ISO6393_TO_6391[first.langConfig.targetCode]
  if (!to) throw new Error("Invalid target language code")
  if (first.provider.provider === "google-translate") {
    return requestGoogleTranslationBatch(
      items.map((data) => prepareGoogleTranslation(data.text, data).requestText),
      from,
      to,
      signal,
    )
  }
  return requestMicrosoftTranslationBatch(
    items.map((data) => data.text),
    from,
    to,
    { textFormat: first.textFormat, signal },
  )
}

export function decodePageMt(raw: unknown, items: PageTranslationData[]): (string | undefined)[] {
  const google = items[0]!.provider.provider === "google-translate"
  const values: unknown = google && Array.isArray(raw) ? raw[0] : raw
  if (!Array.isArray(values) || values.length !== items.length)
    throw new PageProtocolError("Unaligned MT result count")
  return values.map((value: unknown, index) => {
    const item = items[index]!
    let text: unknown = google
      ? value
      : (value as { translations?: { text?: unknown }[] } | null)?.translations?.[0]?.text
    if (typeof text !== "string" || !text.trim()) return undefined
    try {
      if (google)
        text = restoreGoogleTranslation(
          text,
          prepareGoogleTranslation(item.text, item).preservedLines,
        )
      const normalized = normalizeTranslationOutput(item.provider, text as string).trim()
      if (!normalized) return undefined
      if (item.textFormat === "html") assertHtmlAttributeMarkerIntegrity(item.text, normalized)
      return normalized
    } catch {
      return undefined
    }
  })
}
