import type {
  BilingualFormatManifest,
  BilingualFormatToken,
} from "@/utils/host/translate/bilingual-format-protocol"
import { parseBilingualFormat } from "@/utils/host/translate/bilingual-format-protocol"

/** Count complete, nonempty literal pairs outside formatted ranges. Zero means unsafe to escape. */
export function countPlainBracketPairs(tokens: BilingualFormatToken[]): number {
  let depth = 0
  let count = 0
  for (const token of tokens) {
    if (token.type === "open") depth++
    if (token.type === "close") depth--
    if (token.type !== "text" || !/[【】]/.test(token.text)) continue
    if (depth) return 0
    const pairs = /【[^【】]+】/g
    if (/[【】]/.test(token.text.replace(pairs, ""))) return 0
    count += token.text.match(pairs)?.length ?? 0
  }
  return count
}

export function selectMicrosoftRangeGuards(
  text: string,
  manifest: BilingualFormatManifest,
): BilingualFormatManifest["microsoftRangeGuards"] {
  if (!/[【】]/.test(text)) return true
  // Reserve quotation marks for literal brackets only if they cannot collide with source text.
  if (!/["“”]/.test(text)) {
    const literalBracketPairs = countPlainBracketPairs(parseBilingualFormat(text, manifest))
    if (literalBracketPairs) return { literalBracketPairs }
  }
  return (["〈〉", "《》"] as const).find(
    (pair) => !text.includes(pair.charAt(0)) && !text.includes(pair.charAt(1)),
  )
}
