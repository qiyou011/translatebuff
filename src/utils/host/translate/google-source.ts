import type { TranslationTextFormat } from "@/types/config/translate"
import { decodeHTML } from "entities"

export function getGoogleSourceText(text: string, format: TranslationTextFormat): string {
  if (format === "plain") return text
  return decodeHTML(
    text
      .split(/(<(?:[^>"]|"[^"]*")*>)/)
      .filter((_, i) => i % 2 === 0)
      .join(" "),
  )
}

export function hasGoogleArabicSource(text: string, format: TranslationTextFormat): boolean {
  return /\p{Script=Arabic}/u.test(getGoogleSourceText(text, format))
}
