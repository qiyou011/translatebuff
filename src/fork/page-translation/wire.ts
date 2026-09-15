import { isNoTranslationSentinel } from "@/utils/constants/prompt"
import { assertHtmlAttributeMarkerIntegrity } from "@/utils/host/translate/html-attribute-markers"

export class PageProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PageProtocolError"
  }
}

const RAW_TAGS = new Set([
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
])
interface AttributeSpan {
  start: number
  end: number
  name: string
  value: string
}

// MV3-safe lexical scan: never treats quoted values, comments or raw text as tags.
function attributes(html: string): AttributeSpan[] {
  const result: AttributeSpan[] = []
  // Only ASCII tag names need folding; Unicode folding can change string length.
  const lower = html.replace(/[A-Z]/g, (char) => char.toLowerCase())
  let cursor = 0
  while (cursor < html.length) {
    const start = html.indexOf("<", cursor)
    if (start < 0) break
    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4)
      cursor = end < 0 ? html.length : end + 3
      continue
    }
    const tag = /^<([a-z][a-z0-9:-]*)\b/i.exec(html.slice(start))
    if (!tag) {
      cursor = start + 1
      continue
    }
    let end = start + tag[0].length
    let quote = ""
    for (; end < html.length; end++) {
      const char = html[end]!
      if (quote) {
        if (char === quote) quote = ""
      } else if (char === '"' || char === "'") quote = char
      else if (char === ">") break
    }
    if (end === html.length) throw new PageProtocolError("Unclosed HTML tag")
    let pos = start + tag[0].length
    while (pos < end) {
      const match = /^\s*([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/.exec(
        html.slice(pos, end),
      )
      if (!match) break
      const leading = /^\s*/.exec(match[0])![0].length
      result.push({
        start: pos + leading,
        end: pos + match[0].length,
        name: match[1]!.toLowerCase(),
        value: match[2] ?? match[3] ?? match[4] ?? "",
      })
      pos += match[0].length
    }
    cursor = end + 1
    const name = tag[1]!.toLowerCase()
    if (RAW_TAGS.has(name)) {
      if (name === "plaintext") break
      const closing = new RegExp(`</${name}(?=[\\s>])`, "g")
      closing.lastIndex = cursor
      const match = closing.exec(lower)
      if (!match) break
      const closeEnd = html.indexOf(">", match.index)
      cursor = closeEnd < 0 ? html.length : closeEnd + 1
    }
  }
  return result
}

function replaceAttributes(html: string, spans: AttributeSpan[], from: string, to: string): string {
  let output = html
  for (const attr of spans.toReversed()) {
    if (attr.name !== from) continue
    // Values are existing wire encodings, not arbitrary unescaped generated HTML.
    const value =
      /^\d+$/.test(attr.value) && to === "id"
        ? attr.value
        : `"${attr.value.replaceAll('"', "&quot;")}"`
    // A slash immediately after an unquoted value is part of that value in HTML.
    const separator = to === "id" && html[attr.end] === "/" ? " " : ""
    output = output.slice(0, attr.start) + `${to}=${value}${separator}` + output.slice(attr.end)
  }
  return output
}

export function compactPageHtml(source: string): string | null {
  assertHtmlAttributeMarkerIntegrity(source, source)
  const spans = attributes(source)
  if (spans.some((attr) => attr.name === "id")) return null
  return replaceAttributes(source, spans, "data-rf-attr", "id")
}

export function restorePageHtml(source: string, wireOutput: string): string {
  if (isNoTranslationSentinel(wireOutput)) return wireOutput.trim()
  const restored = replaceAttributes(wireOutput, attributes(wireOutput), "id", "data-rf-attr")
  assertHtmlAttributeMarkerIntegrity(source, restored)
  return restored
}

export function parseFlatTranslations(raw: string, count: number): (string | undefined)[] {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PageProtocolError("Expected flat translation object")
  }
  const seen = new Set<string>()
  let depth = 0
  for (let cursor = 0; cursor < raw.length; cursor++) {
    const char = raw[cursor]
    if (char === "{" || char === "[") depth++
    else if (char === "}" || char === "]") depth--
    else if (char === '"') {
      const start = cursor++
      while (cursor < raw.length && raw[cursor] !== '"') {
        if (raw[cursor] === "\\") cursor++
        cursor++
      }
      if (depth === 1 && /^\s*:/.test(raw.slice(cursor + 1))) {
        const key: string = JSON.parse(raw.slice(start, cursor + 1))
        if (seen.has(key) || !/^t(0|[1-9]\d*)$/.test(key) || Number(key.slice(1)) >= count) {
          throw new PageProtocolError("Duplicate or unknown translation key")
        }
        seen.add(key)
      }
    }
  }
  const object = parsed as Record<string, unknown>
  return Array.from({ length: count }, (_, index) => {
    const value = object[`t${index}`]
    return typeof value === "string" && value.trim() ? value.trim() : undefined
  })
}
