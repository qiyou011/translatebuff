import type { BilingualFormatManifest } from "@/utils/host/translate/bilingual-format-protocol"
import { decodeHTMLStrict, escapeText } from "entities"
import {
  bilingualFormatError,
  parseBilingualFormat,
} from "@/utils/host/translate/bilingual-format-protocol"
import { attachRequestErrorMeta } from "@/utils/request/retry-policy"
import { countPlainBracketPairs } from "./microsoft-range-guards"

// Attribute-free inline tags survive Edge's tag aligner. A fixed-width tag
// sequence identifies each range without relying on source/target order.
const alphabet = ["b", "i", "u", "em", "strong", "s", "mark", "del"]
function codes(manifest: BilingualFormatManifest): Map<string, string[]> {
  const width = Math.max(
    1,
    Math.ceil(Math.log(Math.max(1, manifest.formats.length)) / Math.log(alphabet.length)),
  )
  return new Map(
    manifest.formats.map((format, index) => [
      format.id,
      index
        .toString(alphabet.length)
        .padStart(width, "0")
        .split("")
        .map((digit) => alphabet[Number(digit)]!),
    ]),
  )
}

function rangeDelimiters(manifest: BilingualFormatManifest) {
  const guards = manifest.microsoftRangeGuards
  return guards === true || typeof guards === "object" ? "【】" : guards
}

export function encodeMicrosoftFormat(text: string, manifest: BilingualFormatManifest): string {
  const mapping = codes(manifest)
  const delimiters = rangeDelimiters(manifest)
  return parseBilingualFormat(text, manifest)
    .map((token) => {
      if (token.type === "text") {
        const source =
          typeof manifest.microsoftRangeGuards === "object"
            ? token.text.replaceAll("【", "“").replaceAll("】", "”")
            : token.text
        return escapeText(source)
      }
      if (token.type === "atom") return `ZXQATOM${token.id}QXZ`
      const tags = mapping.get(token.id)!
      const guard = /^[DH]/.test(token.id) ? delimiters : undefined
      return token.type === "open"
        ? tags.map((tag) => `<${tag}>`).join("") + (guard?.[0] ?? "")
        : (guard?.[1] ?? "") +
            tags
              .toReversed()
              .map((tag) => `</${tag}>`)
              .join("")
    })
    .join("")
}

export function decodeMicrosoftFormat(text: string, manifest: BilingualFormatManifest): string {
  const mapping = codes(manifest)
  const openings = new Map(
    [...mapping].map(([id, tags]) => [tags.map((tag) => `<${tag}>`).join(""), id]),
  )
  const stack: string[] = []
  let result = "",
    cursor = 0
  while (cursor < text.length) {
    if (text[cursor] !== "<") {
      const next = text.indexOf("<", cursor)
      result += decodeHTMLStrict(text.slice(cursor, next === -1 ? text.length : next))
      cursor = next === -1 ? text.length : next
      continue
    }
    const id = stack.at(-1)
    const closing = id
      ? mapping
          .get(id)!
          .toReversed()
          .map((tag) => `</${tag}>`)
          .join("")
      : undefined
    if (closing && text.startsWith(closing, cursor)) {
      result += `⟦/${stack.pop()}⟧`
      cursor += closing.length
      continue
    }
    const opening = [...openings].find(([sequence]) => text.startsWith(sequence, cursor))
    if (!opening) throw bilingualFormatError("unknown Microsoft tag sequence")
    result += `⟦${opening[1]}⟧`
    stack.push(opening[1])
    cursor += opening[0].length
  }
  if (stack.length) throw bilingualFormatError("unclosed Microsoft range")
  const delimiters = rangeDelimiters(manifest)
  if (delimiters) {
    // Edge can wrap neighbouring prose in its HTML tag. Only move plain text
    // across the boundary, never a nested range or an atom.
    const [left, right] = delimiters
    const plain = `([^⟦⟧${delimiters}]*?)`
    const opening = new RegExp(`(⟦[DH]\\d+⟧)${plain}${left}|⟦[DH]\\d+⟧|${left}`, "g")
    const closing = new RegExp(`${right}${plain}(⟦/[DH]\\d+⟧)|⟦/[DH]\\d+⟧|${right}`, "g")
    result = result
      .replace(opening, (_match, tag: string | undefined, before: string) => {
        if (!tag || before.includes("ZXQATOM"))
          throw bilingualFormatError("damaged Microsoft range delimiter")
        return before + tag
      })
      .replace(closing, (_match, after: string, tag: string | undefined) => {
        if (!tag || after.includes("ZXQATOM"))
          throw bilingualFormatError("damaged Microsoft range delimiter")
        return tag + after
      })
  }
  const literalGuards = manifest.microsoftRangeGuards
  if (typeof literalGuards === "object") {
    result = result.replaceAll("“", "【").replaceAll("”", "】")
    const pairs = countPlainBracketPairs(parseBilingualFormat(result, manifest))
    if (!pairs || pairs !== literalGuards.literalBracketPairs)
      throw bilingualFormatError("damaged Microsoft literal brackets")
  } else {
    parseBilingualFormat(result, manifest)
  }
  return result
}

/** Dedicated serializer-only transport. General Microsoft HTML stays prohibited. */
export async function requestMicrosoftFormatBatch(
  items: { text: string; manifest: BilingualFormatManifest }[],
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const body = JSON.stringify(items.map((item) => encodeMicrosoftFormat(item.text, item.manifest)))
  const response = await fetch(
    `https://edge.microsoft.com/translate/translatetext?from=${encodeURIComponent(from === "auto" ? "" : from)}&to=${encodeURIComponent(to)}&isEnterpriseClient=false`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    },
  )
  if (!response.ok)
    throw attachRequestErrorMeta(
      new Error(`Microsoft format translation failed: ${response.status}`),
      {
        statusCode: response.status,
        responseHeaders: response.headers,
      },
    )
  return response.json()
}
