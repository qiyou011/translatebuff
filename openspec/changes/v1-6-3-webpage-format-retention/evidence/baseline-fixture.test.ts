import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"

const fixture = JSON.parse(readFileSync(new URL("./format-fixtures.json", import.meta.url), "utf8"))
const html = readFileSync(new URL("./format-fixture.html", import.meta.url), "utf8")

describe("重建测试台来源与交互", () => {
  it("完整保留27组原型source和fixtureCss，不包含人工译文", () => {
    expect(fixture.cases).toHaveLength(27)
    const dom = new JSDOM(html)
    for (const c of fixture.cases) {
      expect(html).toContain(c.source)
      expect(dom.window.document.querySelectorAll(`#${c.id}`)).toHaveLength(1)
    }
    expect(html).toContain(fixture.fixtureCss)
    expect(
      dom.window.document.querySelectorAll(".read-frog-translated-content-wrapper"),
    ).toHaveLength(0)
    dom.window.close()
  })

  it("计数和动态新增可操作，重复新增不重复插入", () => {
    const dom = new JSDOM(html, { runScripts: "dangerously" })
    const doc = dom.window.document
    doc.getElementById("sample-action")!.click()
    doc.getElementById("sample-action")!.click()
    expect(doc.getElementById("click-count")!.textContent).toContain("2")
    doc.getElementById("append-dynamic")!.click()
    doc.getElementById("append-dynamic")!.click()
    expect(doc.querySelectorAll("#dynamic-added")).toHaveLength(1)
    expect(doc.querySelector("#dynamic-added code")!.textContent).toBe("/agent/status")
    dom.window.close()
  })
})
