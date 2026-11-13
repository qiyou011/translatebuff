/** Serializable request-local contract. DOM references never cross the message bus. */
export interface BilingualFormatManifest {
  version: 1
  identity: string
  formats: { id: string; parent?: string }[]
  atoms: string[]
  recovery?: boolean
}

export type BilingualFormatToken =
  | { type: "text"; text: string }
  | { type: "open" | "close" | "atom"; id: string }

export function bilingualFormatError(reason: string): Error {
  return new Error(`Bilingual format integrity: ${reason}`)
}

export function isBilingualFormatError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Bilingual format integrity:")
}

/** Validate BEFORE cache admission or rendering, including on a cache hit. */
export function parseBilingualFormat(
  text: string,
  manifest: BilingualFormatManifest,
): BilingualFormatToken[] {
  if (manifest.version !== 1) throw bilingualFormatError("unsupported rules version")
  const formats = new Map(manifest.formats.map((f) => [f.id, f]))
  const atoms = new Set(manifest.atoms)
  if (formats.size !== manifest.formats.length || atoms.size !== manifest.atoms.length)
    throw bilingualFormatError("duplicate source identifier")
  const seenFormats = new Set<string>(),
    seenAtoms = new Set<string>()
  const stack: { id: string; hasContent: boolean }[] = []
  const tokens: BilingualFormatToken[] = []
  let offset = 0
  const appendText = (part: string) => {
    if (/⟦|⟧|ZXQATOM|QXZ/.test(part)) throw bilingualFormatError("damaged or unknown token")
    if (part) tokens.push({ type: "text", text: part })
    if (part.trim()) for (const frame of stack) frame.hasContent = true
  }
  for (const match of text.matchAll(/⟦(\/?)([BHIUD]\d+)⟧|ZXQATOM(\d+)QXZ/g)) {
    appendText(text.slice(offset, match.index))
    offset = match.index + match[0].length
    if (match[3] !== undefined) {
      const id = match[3]
      if (!atoms.has(id) || seenAtoms.has(id))
        throw bilingualFormatError("unknown or duplicate atom")
      seenAtoms.add(id)
      for (const frame of stack) frame.hasContent = true
      tokens.push({ type: "atom", id })
    } else {
      const id = match[2]!,
        format = formats.get(id)
      if (!format) throw bilingualFormatError("unknown format")
      if (match[1]) {
        const frame = stack.pop()
        if (frame?.id !== id || !frame.hasContent)
          throw bilingualFormatError("crossed or empty range")
        tokens.push({ type: "close", id })
      } else {
        if (seenFormats.has(id) || format.parent !== stack.at(-1)?.id)
          throw bilingualFormatError("duplicate or reparented range")
        seenFormats.add(id)
        stack.push({ id, hasContent: false })
        tokens.push({ type: "open", id })
      }
    }
  }
  appendText(text.slice(offset))
  if (stack.length || seenFormats.size !== formats.size || seenAtoms.size !== atoms.size)
    throw bilingualFormatError("missing range or atom")
  return tokens
}

export function withoutBilingualFormatting(text: string): string {
  return text.replace(/⟦\/?[BHIUD]\d+⟧/g, "")
}
