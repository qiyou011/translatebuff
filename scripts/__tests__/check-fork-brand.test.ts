import { describe, expect, it } from "vitest"
import { findResidualBrand } from "../check-fork-brand.mjs"

describe("findResidualBrand", () => {
  it("揪出上游品牌残留（拉丁 Read Frog）", () => {
    const content = ["name: Read Frog", "notification: What's new in Read Frog"].join("\n")
    const v = findResidualBrand([{ path: "src/locales/x.yml", content }])
    expect(v.map((x) => x.line)).toEqual([1, 2])
    expect(v[0]!.token).toBe("Read Frog")
  })

  it("覆盖中文与日语意译品牌 token", () => {
    const content = ["a: 陪读蛙功能", "b: 陪讀蛙功能", "c: 読書カエルの情報"].join("\n")
    const v = findResidualBrand([{ path: "src/locales/x.yml", content }])
    expect(v.map((x) => x.token)).toEqual(["陪读蛙", "陪讀蛙", "読書カエル"])
  })

  it("揪出小写 Translatebuff（英文名必须大写 B）", () => {
    const content = ["name: Translatebuff", "desc: about Translatebuff here"].join("\n")
    const v = findResidualBrand([{ path: "src/locales/x.yml", content }])
    expect(v.map((x) => x.line)).toEqual([1, 2])
    expect(v[0]!.token).toBe("Translatebuff")
  })

  it("放行正确大写 TranslateBuff", () => {
    const content = "name: TranslateBuff\ntitle: Settings | TranslateBuff"
    expect(findResidualBrand([{ path: "src/locales/x.yml", content }])).toEqual([])
  })

  it("不误伤域名 translatebuff.com 与 kebab translate-buff", () => {
    const content = [
      "hint: Sign in on translatebuff.com before continuing.",
      "css: \"[data-read-frog-style='custom']\"",
      "elem: translate-buff",
    ].join("\n")
    expect(findResidualBrand([{ path: "src/locales/x.yml", content }])).toEqual([])
  })

  it("揪出入口 html 的品牌违规", () => {
    const content = "<head>\n    <title>Options | Translatebuff</title>\n</head>"
    const v = findResidualBrand([{ path: "src/entrypoints/options/index.html", content }])
    expect(v).toHaveLength(1)
    expect(v[0]!.line).toBe(2)
  })

  it("干净输入无违规", () => {
    const v = findResidualBrand([
      { path: "src/locales/x.yml", content: "name: TranslateBuff\nb: 任译喵" },
      {
        path: "src/entrypoints/options/index.html",
        content: "    <title>Settings | TranslateBuff</title>",
      },
    ])
    expect(v).toEqual([])
  })
})
