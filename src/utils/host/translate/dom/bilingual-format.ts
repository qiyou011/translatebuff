import type { BilingualFormatManifest } from "../bilingual-format-protocol"
import type { VirtualParagraphSourceFragment } from "./paragraph-segmentation"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { Sha256Hex } from "@/utils/hash"
import { parseBilingualFormat } from "../bilingual-format-protocol"

interface FormatStyle {
  tag: string
  background?: string
  backgroundImage?: string
}
export interface BilingualFormatSource {
  text: string
  plainText: string
  manifest: BilingualFormatManifest
  styles: Record<string, FormatStyle>
  atoms: Record<string, Node>
}

const atomTags = new Set(["code", "kbd", "samp", "sup", "sub", "math"])
const allowedAtomTags = new Set([
  "code",
  "kbd",
  "samp",
  "sup",
  "sub",
  "span",
  "br",
  "math",
  "mrow",
  "mi",
  "mn",
  "mo",
  "ms",
  "mtext",
  "mspace",
  "msup",
  "msub",
  "msubsup",
  "mfrac",
  "msqrt",
  "mroot",
  "munder",
  "mover",
  "munderover",
  "mtable",
  "mtr",
  "mtd",
  "mfenced",
  "semantics",
])
const omittedTags = new Set([
  "script",
  "style",
  "template",
  "noscript",
  "svg",
  "img",
  "button",
  "input",
  "select",
  "textarea",
  "iframe",
  "object",
  "embed",
  "annotation",
  "annotation-xml",
])

function safeAtom(node: Node, doc: Document): Node {
  if (node.nodeType === 3) return doc.createTextNode(node.textContent ?? "")
  if (node.nodeType !== 1) return doc.createTextNode("")
  const source = node as Element,
    tag = source.localName.toLowerCase()
  if (omittedTags.has(tag)) return doc.createTextNode("")
  const target = allowedAtomTags.has(tag)
    ? source.namespaceURI === "http://www.w3.org/1998/Math/MathML"
      ? doc.createElementNS(source.namespaceURI, tag)
      : doc.createElement(tag)
    : doc.createElement("span")
  for (const child of source.childNodes) target.appendChild(safeAtom(child, doc))
  if (target.namespaceURI === "http://www.w3.org/1999/xhtml")
    (target as HTMLElement).style.color = "inherit"
  if (["code", "kbd", "samp"].includes(tag)) {
    const el = target as HTMLElement
    el.style.fontFamily = 'ui-monospace, "SFMono-Regular", Consolas, monospace'
    el.style.whiteSpace = "pre-wrap"
  }
  return target
}

/** Extract a unit without touching original nodes, controls or event listeners. */
export function extractBilingualFormat(
  nodes: readonly Node[],
  preserveLineBreaks = false,
  fragments?: readonly VirtualParagraphSourceFragment[],
): BilingualFormatSource {
  const doc = nodes[0]?.ownerDocument ?? document
  const view = doc.defaultView!
  const formats: BilingualFormatManifest["formats"] = []
  const styles: BilingualFormatSource["styles"] = {},
    atoms: BilingualFormatSource["atoms"] = {}
  const atomIdentities: string[] = []
  let sequence = 0,
    prose = ""
  const selected = fragments
    ? new Map<Node, VirtualParagraphSourceFragment>(
        fragments.map((fragment) => [fragment.source, fragment]),
      )
    : undefined
  const ancestors = new Set<Node>()
  for (const fragment of fragments ?? []) {
    let cursor: Node | null = fragment.source
    while (cursor) {
      ancestors.add(cursor)
      cursor = cursor.parentNode
    }
  }
  const atom = (node: Node) => {
    const id = String(sequence++)
    atoms[id] = safeAtom(node, doc)
    atomIdentities.push(
      `${id}:${node.nodeType === 1 ? (node as Element).outerHTML : node.textContent}`,
    )
    return `ZXQATOM${id}QXZ`
  }
  const text = (value: string, keepLines: boolean) => {
    const normalized = keepLines ? value.replace(/\r\n?/g, "\n") : value.replace(/\s+/g, " ")
    prose += normalized
    return normalized.replace(/⟦[^⟧]*⟧|⟦|⟧|ZXQATOM\d*QXZ|ZXQATOM|QXZ/g, (literal) =>
      atom(doc.createTextNode(literal)),
    )
  }
  const visit = (node: Node, parent?: string, keepLines = preserveLineBreaks): string => {
    if (selected && !ancestors.has(node)) return ""
    if (node.nodeType === 3) {
      const slice = selected?.get(node)
      return text(
        slice
          ? (node.textContent ?? "").slice(slice.startOffset, slice.endOffset)
          : (node.textContent ?? ""),
        keepLines,
      )
    }
    if (node.nodeType !== 1) return ""
    const el = node as HTMLElement,
      tag = el.localName.toLowerCase()
    if (
      omittedTags.has(tag) ||
      el.classList.contains(CONTENT_WRAPPER_CLASS) ||
      el.hidden ||
      el.getAttribute("aria-hidden") === "true"
    )
      return ""
    const computed = view.getComputedStyle(el)
    if (computed.display === "none" || computed.visibility === "hidden") return ""
    // The prototype's transparent section anchor is auxiliary; opacity alone is NOT a generic skip rule.
    if (
      tag === "a" &&
      el.getAttribute("href")?.startsWith("#") &&
      el.textContent?.trim() === "#" &&
      computed.opacity === "0"
    )
      return ""
    if (atomTags.has(tag)) return atom(el)
    if (tag === "br") {
      prose += "\n"
      return "\n"
    }
    const preserve =
      keepLines ||
      /^(pre|pre-wrap|pre-line|break-spaces)$/.test(computed.whiteSpace) ||
      tag === "pre"
    const kinds: [string, FormatStyle][] = []
    const parentStyle = el.parentElement ? view.getComputedStyle(el.parentElement) : null
    if (
      tag === "b" ||
      tag === "strong" ||
      ((computed.fontWeight === "bold" || Number(computed.fontWeight) >= 600) &&
        computed.fontWeight !== parentStyle?.fontWeight)
    )
      kinds.push(["B", { tag: "strong" }])
    const background = computed.backgroundColor
    const gradient = computed.backgroundImage
    const hasBackground =
      background && background !== "transparent" && background !== "rgba(0, 0, 0, 0)"
    const safeGradient =
      /^(?:repeating-)?linear-gradient\(/i.test(gradient) && !/url\(|var\(/i.test(gradient)
    if (tag === "mark" || ((tag === "span" || tag === "a") && (hasBackground || safeGradient)))
      kinds.push([
        "H",
        {
          tag: "mark",
          background: hasBackground ? background : undefined,
          backgroundImage: safeGradient ? gradient : undefined,
        },
      ])
    if (tag === "em" || tag === "i") kinds.push(["I", { tag: "em" }])
    if (tag === "u") kinds.push(["U", { tag: "u" }])
    if (tag === "del" || tag === "s") kinds.push(["D", { tag: "del" }])
    const ids: string[] = []
    for (const [kind, style] of kinds) {
      const id = `${kind}${sequence++}`
      formats.push({ id, ...(parent ? { parent } : {}) })
      styles[id] = style
      ids.push(id)
      parent = id
    }
    const body = [...el.childNodes].map((child) => visit(child, parent, preserve)).join("")
    if (!body.trim()) {
      for (const id of ids) {
        formats.splice(
          formats.findIndex((f) => f.id === id),
          1,
        )
        delete styles[id]
      }
      return body
    }
    return (
      ids.map((id) => `⟦${id}⟧`).join("") +
      body +
      ids
        .toReversed()
        .map((id) => `⟦/${id}⟧`)
        .join("")
    )
  }
  const serialized = nodes
    .map((node) => visit(node))
    .join("")
    .trim()
  const manifest: BilingualFormatManifest = {
    version: 1,
    identity: Sha256Hex(serialized, JSON.stringify(styles), JSON.stringify(atomIdentities)),
    formats,
    atoms: Object.keys(atoms),
  }
  return { text: serialized, plainText: prose.trim(), manifest, styles, atoms }
}

export function renderBilingualFormat(
  target: HTMLElement,
  text: string,
  source: BilingualFormatSource,
  recovery = false,
): void {
  const manifest = recovery ? { ...source.manifest, formats: [], recovery: true } : source.manifest
  const tokens = parseBilingualFormat(text, manifest)
  const doc = target.ownerDocument,
    fragment = doc.createDocumentFragment()
  const stack: (DocumentFragment | HTMLElement)[] = [fragment]
  for (const token of tokens) {
    const parent = stack.at(-1)!
    if (token.type === "text") parent.appendChild(doc.createTextNode(token.text))
    else if (token.type === "atom") parent.appendChild(source.atoms[token.id]!.cloneNode(true))
    else if (token.type === "close") stack.pop()
    else {
      const style = source.styles[token.id]!,
        element = doc.createElement(style.tag)
      element.style.color = "inherit"
      if (style.background) element.style.backgroundColor = style.background
      if (style.backgroundImage) element.style.backgroundImage = style.backgroundImage
      parent.appendChild(element)
      stack.push(element)
    }
  }
  target.replaceChildren(fragment)
  target.style.whiteSpace = "pre-wrap"
  target.dataset.readFrogFormatStatus = recovery ? "degraded" : "normal"
}
