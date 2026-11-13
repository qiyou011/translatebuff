// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { extractBilingualFormat, renderBilingualFormat } from "../bilingual-format"

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("bilingual format extraction and safe rebuilding", () => {
  it("protects visible code even when marked translate=no", () => {
    document.body.innerHTML =
      '<p>Run <code translate="no">npm install example-package</code> now.</p>'
    const source = extractBilingualFormat([document.querySelector("p")!])
    expect(source.manifest.atoms).toHaveLength(1)
    expect(source.atoms["0"]?.textContent).toBe("npm install example-package")
  })
  it("keeps styles on a virtual paragraph slice without translating its neighbours", () => {
    document.body.innerHTML =
      '<div style="white-space:pre-wrap">Before\n\n<strong>Save the account</strong> now\n\nAfter</div>'
    const root = document.querySelector("div")!
    const selected = root.querySelector("strong")!.firstChild as Text
    const tail = root.querySelector("strong")!.nextSibling as Text
    const source = extractBilingualFormat([root], true, [
      { source: selected, startOffset: 0, endOffset: selected.length, atomic: false },
      { source: tail, startOffset: 0, endOffset: 4, atomic: false },
    ])
    expect(source.text).toBe("⟦B0⟧Save the account⟦/B0⟧ now")
  })
  it("extracts computed bold/highlight and protects code with stable format identity", () => {
    document.body.innerHTML =
      '<p>Read <span style="font-weight:800">this notice</span> and <span style="background-color:yellow">save now</span>. Run <code id="original">a &lt; b</code>.</p>'
    const p = document.querySelector("p")!
    const source = extractBilingualFormat([p])
    expect(source.manifest.formats.map((f) => f.id[0])).toEqual(["B", "H"])
    expect(source.manifest.atoms).toHaveLength(1)
    const target = document.createElement("span")
    renderBilingualFormat(target, source.text, source)
    expect(target.querySelector("strong")!.textContent).toBe("this notice")
    expect(target.querySelector("mark")!.textContent).toBe("save now")
    expect(target.querySelector("code")!.textContent).toBe("a < b")
    expect(target.querySelector("[id]")).toBeNull()
    expect(extractBilingualFormat([p]).manifest.identity).toBe(source.manifest.identity)
    p.querySelector("code")!.textContent = "a > b"
    expect(extractBilingualFormat([p]).manifest.identity).not.toBe(source.manifest.identity)
  })
  it("preserves visible breaks but collapses source whitespace and omits controls/decorations", () => {
    document.body.innerHTML =
      "<p>First\n line<br>Second <b>line</b><button>Click</button><svg><text>icon</text></svg><span hidden>hidden</span></p>"
    const source = extractBilingualFormat([document.querySelector("p")!])
    expect(source.text).toContain("First line\nSecond")
    expect(source.text).not.toMatch(/Click|icon|hidden/)
    expect(source.text).toContain("⟦B0⟧line⟦/B0⟧")
  })
  it("never clones executable descendants or source IDs and restores native MathML in place", () => {
    document.body.innerHTML =
      '<p>Compute <math id="m"><msup><mi>x</mi><mn>2</mn></msup><annotation-xml><script>bad()</script></annotation-xml></math> now.</p>'
    const source = extractBilingualFormat([document.querySelector("p")!])
    const target = document.createElement("span")
    renderBilingualFormat(target, source.text, source)
    expect(target.querySelector("math msup")!.textContent).toBe("x2")
    expect(target.querySelector("script,annotation-xml,[id]")).toBeNull()
    expect(target.textContent).toBe("Compute x2 now.")
    expect(() => renderBilingualFormat(target, "Compute now.", source)).toThrow(/Bilingual format/)
  })
  it("protects literal protocol-like source text from collisions", () => {
    document.body.innerHTML = "<p>The literal ⟦B0⟧ and ZXQATOM0QXZ are <b>examples</b>.</p>"
    const source = extractBilingualFormat([document.querySelector("p")!])
    const target = document.createElement("span")
    renderBilingualFormat(target, source.text, source)
    expect(target.textContent).toBe("The literal ⟦B0⟧ and ZXQATOM0QXZ are examples.")
  })
})
