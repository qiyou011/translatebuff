import { readFileSync } from "node:fs"
// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

// 上游「产品」组是「路线图 + 帮助与社区」；任译喵没有路线图页，故整条隐藏。
// 用源码断言而非渲染：ProductNav 依赖 react-router 的 useLocation，
// 单独渲染要搭一整个 Router，代价大于收益。
describe("fork options 侧边栏「产品」组", () => {
  it("不含路线图入口", () => {
    const src = readFileSync("src/fork/ui/options/product-nav.tsx", "utf8")
    expect(src).not.toContain("roadmap")
    expect(src).not.toContain("buildFeaturebasePortalUrl")
  })

  it("保留帮助与社区入口", () => {
    const src = readFileSync("src/fork/ui/options/product-nav.tsx", "utf8")
    expect(src).toContain("/help-and-community")
  })
})
