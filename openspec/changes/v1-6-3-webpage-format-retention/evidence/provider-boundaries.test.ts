import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { assertHtmlAttributeMarkerIntegrity } from "@/utils/host/translate/html-attribute-markers"

const captured = JSON.parse(
  readFileSync(new URL("./protocol-probe-results.json", import.meta.url), "utf8"),
)

describe("已采集服务响应的复用边界（不是产品通过测试）", () => {
  it("现有HTML属性校验接受正常谷歌标记并拒绝缺失/重复/新增属性", () => {
    const group = captured.output.find(
      (g: { provider: string; targetCode: string }) =>
        g.provider === "google-translate" && g.targetCode === "cmn",
    )
    const sample = group.samples.find((s: { id: string }) => s.id === "REPEAT")
    const translated = sample.result.value as string
    expect(() => assertHtmlAttributeMarkerIntegrity(sample.wire, translated)).not.toThrow()
    expect(() =>
      assertHtmlAttributeMarkerIntegrity(sample.wire, translated.replace('data-rf-attr="B0"', "")),
    ).toThrow(/HTML attribute/)
    expect(() =>
      assertHtmlAttributeMarkerIntegrity(sample.wire, `${translated}<b data-rf-attr="B0">重复</b>`),
    ).toThrow(/HTML attribute/)
    expect(() =>
      assertHtmlAttributeMarkerIntegrity(
        sample.wire,
        `${translated}<b data-rf-attr="B99">新增</b>`,
      ),
    ).toThrow(/HTML attribute/)
  })

  it("真实谷歌响应中的重复原子文本未被属性校验发现，不能直接复用作成功校验", () => {
    const group = captured.output.find(
      (g: { provider: string; targetCode: string }) =>
        g.provider === "google-translate" && g.targetCode === "jpn",
    )
    const sample = group.samples.find((s: { id: string }) => s.id === "REPEAT")
    const translated = sample.result.value as string
    expect(() => assertHtmlAttributeMarkerIntegrity(sample.wire, translated)).not.toThrow()
    // One ID attribute plus TWO text occurrences: one escaped its protected span.
    expect(translated.match(/ZXQATOM2QXZ/g)).toHaveLength(3)
    expect(sample.wire.match(/ZXQATOM2QXZ/g)).toHaveLength(2)
  })

  it("真实微软响应丢失成对格式边界，不能仅因请求成功就准入格式缓存", () => {
    const group = captured.output.find(
      (g: { provider: string; targetCode: string }) =>
        g.provider === "microsoft-translate" && g.targetCode === "jpn",
    )
    const sample = group.samples.find((s: { id: string }) => s.id === "REORDER")
    expect(sample.result.status).toBe("fulfilled")
    expect(sample.text).toContain("⟦B0⟧")
    expect(sample.result.value).not.toContain("⟦B0⟧")
    expect(sample.result.value).not.toContain("⟦/H1⟧")
  })
})
