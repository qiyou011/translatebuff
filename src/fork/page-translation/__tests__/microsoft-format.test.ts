import { describe, expect, it } from "vitest"
import { decodeMicrosoftFormat, encodeMicrosoftFormat } from "../microsoft-format"
describe("Microsoft serializer-only protocol", () => {
  it("round-trips more ranges than available tags without relying on returned order", () => {
    const formats = Array.from({ length: 20 }, (_, index) => ({ id: `B${index}` }))
    const manifest = { version: 1 as const, identity: "many", formats, atoms: ["21"] }
    const source =
      formats
        .map((f) => `⟦${f.id}⟧text⟦/${f.id}⟧`)
        .reverse()
        .join(" and ") + " ZXQATOM21QXZ"
    expect(decodeMicrosoftFormat(encodeMicrosoftFormat(source, manifest), manifest)).toBe(source)
  })
  it("escapes source HTML and refuses invented attributes and mismatched ranges", () => {
    const manifest = { version: 1 as const, identity: "safe", formats: [{ id: "H0" }], atoms: [] }
    const source = "literal <img src=x onerror=alert(1)> ⟦H0⟧notice⟦/H0⟧"
    const wire = encodeMicrosoftFormat(source, manifest)
    expect(wire).not.toContain("<img")
    expect(decodeMicrosoftFormat(wire, manifest)).toBe(source)
    expect(() => decodeMicrosoftFormat('<b onclick="evil()">notice</b>', manifest)).toThrow(
      "Bilingual format integrity",
    )
    expect(() => decodeMicrosoftFormat("<b>notice</i>", manifest)).toThrow(
      "Bilingual format integrity",
    )
  })
})
