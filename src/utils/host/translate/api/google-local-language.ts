import { eld } from "eld/large"
import { getGoogleSourceText, hasGoogleArabicSource } from "../google-source"

const GOOGLE_ARABIC_SCRIPT_LANGUAGES = new Set(["ar", "fa", "ur"])

/** Local hints only: keep uncertain short/ambiguous text on Google's auto path. */
export function resolveGoogleSourceLanguage(requestText: string): string {
  if (!hasGoogleArabicSource(requestText, "html")) return "auto"
  const text = getGoogleSourceText(requestText, "html")
  // ELD can label short Arabic greetings as reliable Persian. Require more
  // evidence than its reliability flag alone; these scores are not probabilities.
  if ((text.match(/\p{L}/gu)?.length ?? 0) < 16) return "auto"
  const result = eld.detect(text)
  if (!result.isReliable() || !GOOGLE_ARABIC_SCRIPT_LANGUAGES.has(result.language)) return "auto"
  const scores = Object.values(result.getScores()).sort((a, b) => b - a)
  if (scores.length < 2 || scores[0]! - scores[1]! < 0.01) return "auto"
  return result.language
}
