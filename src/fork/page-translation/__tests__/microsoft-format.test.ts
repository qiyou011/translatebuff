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
  it.each([
    ["D5", "outdated instruction", "过时的说明"],
    ["H1", "pending payment will be checked tomorrow", "待处理付款将于明天检查"],
  ])(
    "preserves the whole translated %s range and strips only validated delimiters",
    (id, phrase, translation) => {
      const manifest = {
        version: 1 as const,
        identity: "range",
        formats: [{ id }],
        atoms: [],
        microsoftRangeGuards: true as const,
      }
      expect(encodeMicrosoftFormat(`⟦${id}⟧${phrase}⟦/${id}⟧`, manifest)).toBe(
        `<b>【${phrase}】</b>`,
      )
      expect(decodeMicrosoftFormat(`<b>【${translation}】</b>`, manifest)).toBe(
        `⟦${id}⟧${translation}⟦/${id}⟧`,
      )
      expect(() => decodeMicrosoftFormat(`【<b>${translation}】</b>`, manifest)).toThrow(
        "delimiter",
      )
      expect(() => decodeMicrosoftFormat(`<b>${translation}</b>`, manifest)).toThrow("delimiter")
      expect(
        decodeMicrosoftFormat(`<b>【${translation}】</b>`, {
          ...manifest,
          microsoftRangeGuards: undefined,
        }),
      ).toContain(`【${translation}】`)
    },
  )
  it("keeps literal brackets and places widened neighbouring prose outside the highlight", () => {
    const manifest = {
      version: 1 as const,
      identity: "literal",
      formats: [{ id: "H0" }],
      atoms: [],
      microsoftRangeGuards: "〈〉" as const,
    }
    const source = "Original 【account】, ⟦H0⟧pending payment will be checked tomorrow⟦/H0⟧."
    expect(encodeMicrosoftFormat(source, manifest)).toBe(
      "Original 【account】, <b>〈pending payment will be checked tomorrow〉</b>.",
    )
    expect(
      decodeMicrosoftFormat("<b>原始【账户】，〈待处理付款将于明天检查〉。</b>", manifest),
    ).toBe("原始【账户】，⟦H0⟧待处理付款将于明天检查⟦/H0⟧。")
    expect(() =>
      decodeMicrosoftFormat("<b>原始【账户】，待处理付款将于明天检查。</b>", manifest),
    ).toThrow("delimiter")
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
