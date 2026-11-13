import { describe, expect, it } from "vitest"
import {
  parseBilingualFormat,
  type BilingualFormatManifest,
} from "@/utils/host/translate/bilingual-format-protocol"
import { decodeBilingualFormat, encodeBilingualFormat } from "../bilingual-format-adapter"

const manifest: BilingualFormatManifest = {
  version: 1,
  identity: "test-source",
  formats: [{ id: "B0" }, { id: "H1" }],
  atoms: ["2"],
}
const source = "The ⟦B0⟧account⟦/B0⟧ needs ⟦H1⟧verification⟦/H1⟧. Run ZXQATOM2QXZ."

describe("bilingual format transport", () => {
  it("keeps the complete paragraph in one provider item and round-trips both encodings", () => {
    for (const provider of ["google-translate", "microsoft-translate"] as const) {
      const wire = encodeBilingualFormat(source, manifest, provider)
      expect(typeof wire.text).toBe("string")
      expect(wire.text).toContain("account")
      expect(wire.text).toContain("verification")
      const restored = decodeBilingualFormat(wire.text, manifest, provider)
      expect(
        parseBilingualFormat(restored, manifest).filter((t) => t.type === "atom"),
      ).toHaveLength(1)
    }
  })
  it("accepts reordered complete ranges, and rejects missing, duplicate, unknown and crossing tokens", () => {
    expect(() =>
      parseBilingualFormat("⟦H1⟧验证⟦/H1⟧⟦B0⟧账户⟦/B0⟧ZXQATOM2QXZ", manifest),
    ).not.toThrow()
    for (const bad of [
      source.replace("⟦B0⟧", ""),
      source + "ZXQATOM2QXZ",
      source + "ZXQATOM9QXZ",
      source.replace("⟦/B0⟧", "⟦H1⟧"),
    ]) {
      expect(() => parseBilingualFormat(bad, manifest)).toThrow(/Bilingual format/)
    }
  })
  it("rejects executable attributes, unknown HTML, and atoms duplicated outside protected spans", () => {
    const wire = encodeBilingualFormat(source, manifest, "google-translate").text
    for (const bad of [
      wire.replace("<b ", '<b onclick="evil()" '),
      wire + "<script>evil()</script>",
      wire + "ZXQATOM2QXZ",
    ]) {
      expect(() => decodeBilingualFormat(bad, manifest, "google-translate")).toThrow(
        /Bilingual format/,
      )
    }
  })
})
