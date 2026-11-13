import type { BilingualFormatManifest } from "@/utils/host/translate/bilingual-format-protocol"
import { decodeHTMLStrict, escapeText } from "entities"
import {
  bilingualFormatError,
  parseBilingualFormat,
} from "@/utils/host/translate/bilingual-format-protocol"
import { attachRequestErrorMeta } from "@/utils/request/retry-policy"

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

export function encodeMicrosoftFormat(text: string, manifest: BilingualFormatManifest): string {
  const mapping = codes(manifest)
  return parseBilingualFormat(text, manifest)
    .map((token) => {
      if (token.type === "text") return escapeText(token.text)
      if (token.type === "atom") return `ZXQATOM${token.id}QXZ`
      const tags = mapping.get(token.id)!
      return token.type === "open"
        ? tags.map((tag) => `<${tag}>`).join("")
        : tags
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
  parseBilingualFormat(result, manifest)
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
