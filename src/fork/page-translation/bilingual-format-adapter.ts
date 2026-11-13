import type { BilingualFormatManifest } from "@/utils/host/translate/bilingual-format-protocol"
import { decodeHTMLStrict, escapeText } from "entities"
import {
  bilingualFormatError,
  parseBilingualFormat,
} from "@/utils/host/translate/bilingual-format-protocol"
import { decodeMicrosoftFormat, encodeMicrosoftFormat } from "./microsoft-format"

const tags: Record<string, string> = { B: "b", H: "mark", I: "i", U: "u", D: "del" }

export function encodeBilingualFormat(
  text: string,
  manifest: BilingualFormatManifest,
  provider: string,
): { text: string; textFormat: "plain" | "html" } {
  const tokens = parseBilingualFormat(text, manifest)
  if (provider === "microsoft-translate") {
    return { text: encodeMicrosoftFormat(text, manifest), textFormat: "plain" }
  }
  if (provider !== "google-translate") throw bilingualFormatError("unsupported provider")
  return {
    text: tokens
      .map((t) => {
        if (t.type === "text") return escapeText(t.text)
        if (t.type === "atom")
          return `<span translate="no" data-rf-attr="A${t.id}">ZXQATOM${t.id}QXZ</span>`
        const tag = tags[t.id[0]!]!
        return t.type === "open" ? `<${tag} data-rf-attr="${t.id}">` : `</${tag}>`
      })
      .join(""),
    textFormat: "html",
  }
}

/** A deliberately small protocol parser, not an HTML renderer. No provider DOM is inserted. */
export function decodeBilingualFormat(
  text: string,
  manifest: BilingualFormatManifest,
  provider: string,
): string {
  if (provider === "microsoft-translate") {
    return decodeMicrosoftFormat(text, manifest)
  }
  if (provider !== "google-translate") throw bilingualFormatError("unsupported provider")
  const stack: { tag: string; id: string; atom: boolean }[] = []
  let result = "",
    offset = 0
  const appendText = (part: string) => {
    const decoded = decodeHTMLStrict(part)
    if (stack.at(-1)?.atom) {
      if (decoded.trim() !== `ZXQATOM${stack.at(-1)!.id.slice(1)}QXZ`)
        throw bilingualFormatError("altered atom content")
    } else result += decoded
  }
  for (const match of text.matchAll(/<[^>]*>/g)) {
    appendText(text.slice(offset, match.index))
    offset = match.index + match[0].length
    const closing = /^<\/(b|mark|i|u|del|span)\s*>$/i.exec(match[0])
    if (closing) {
      const frame = stack.pop()
      if (!frame || frame.tag !== closing[1]!.toLowerCase())
        throw bilingualFormatError("invalid HTML nesting")
      result += frame.atom ? `ZXQATOM${frame.id.slice(1)}QXZ` : `⟦/${frame.id}⟧`
      continue
    }
    const opening = /^<(b|mark|i|u|del|span)\b([^>]*)>$/i.exec(match[0])
    if (!opening || stack.at(-1)?.atom) throw bilingualFormatError("unknown HTML")
    const tag = opening[1]!.toLowerCase(),
      attributes = opening[2]!
    const idMatch = /\sdata-rf-attr=(?:"([BHIUDA]\d+)"|'([BHIUDA]\d+)')/i.exec(attributes)
    const id = idMatch?.[1] ?? idMatch?.[2]
    if (!id) throw bilingualFormatError("missing HTML identifier")
    let remainder = attributes.replace(idMatch![0], "")
    if (tag === "span") remainder = remainder.replace(/\stranslate=(?:"no"|'no')/i, "")
    if (remainder.trim() || (tag === "span" ? !id.startsWith("A") : tags[id[0]!] !== tag))
      throw bilingualFormatError("unexpected HTML attributes or tag")
    stack.push({ tag, id, atom: tag === "span" })
    if (tag !== "span") result += `⟦${id}⟧`
  }
  appendText(text.slice(offset))
  if (stack.length) throw bilingualFormatError("unclosed HTML")
  parseBilingualFormat(result, manifest)
  return result
}
