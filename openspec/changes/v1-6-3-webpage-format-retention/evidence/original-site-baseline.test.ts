import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"

const baseline = JSON.parse(
  readFileSync(new URL("./original-site-baseline.json", import.meta.url), "utf8"),
)
const html = readFileSync(new URL("./original-site-20261113.html", import.meta.url), "utf8")

describe("当前原站验收输入", () => {
  it("原始HTML和样式内容与采集时哈希相同", () => {
    expect(createHash("sha256").update(html).digest("hex")).toBe(baseline.sha256)
    const css = readFileSync(new URL(`./${baseline.stylesheet.file}`, import.meta.url), "utf8")
    expect(createHash("sha256").update(css).digest("hex")).toBe(baseline.stylesheet.sha256)
    expect(baseline.status).toBe(200)
    expect(baseline.finalUrl).toBe("https://iphone-use.leeguoo.com/en/")
  })

  it("六组基线可在原始快照中唯一定位且原文一致", () => {
    const dom = new JSDOM(html)
    expect(baseline.samples).toHaveLength(6)
    for (const sample of baseline.samples) {
      const matches = [...dom.window.document.querySelectorAll(sample.selector)].filter(
        (el) => !sample.contains || el.textContent.includes(sample.contains),
      )
      expect(matches).toHaveLength(1)
      expect(matches[0]!.outerHTML).toBe(sample.source)
    }
    const lede = dom.window.document.querySelector("p.du-lede")!
    expect(lede.querySelector(".mark")!.textContent).toBe("Let AI agents use your real iPhone.")
    expect(lede.querySelector("strong")!.textContent.replace(/\s+/g, " ")).toBe(
      "including the ones with no API",
    )
    // This is a new live-site baseline, not the historical F24 paragraph.
    expect(lede.textContent).not.toContain("A daemon on your Mac")
    dom.window.close()
  })
})
