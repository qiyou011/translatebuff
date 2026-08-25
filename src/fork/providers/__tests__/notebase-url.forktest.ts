import { describe, expect, it, vi } from "vitest"

// 本地预览（WXT_WEBSITE_URL 指向 localhost）时，官网走 hash 路由：
// 上游的 new URL(path, base) 直拼会产出 http://localhost:3000/notebase/nb-1 —— 该路由不存在，
// 联调直接 404。fork 的 getWebsiteUrl 在这种情况下改用 #/notebase/nb-1。
//
// 注意：默认测试环境的 WXT_WEBSITE_URL 不是 localhost，两种实现输出完全一致，
// 所以必须显式把 env 打到 localhost 才能命中差异分支。
vi.mock("@/env", () => ({ env: { WXT_WEBSITE_URL: "http://localhost:3000" } }))

describe("fork 笔记库链接（本地预览）", () => {
  it("localhost 下走 hash 路由，而非上游的直拼路径", async () => {
    const { getNotebaseDetailUrl } = await import("@/utils/notebase/pending-save")
    expect(getNotebaseDetailUrl("nb-1")).toBe("http://localhost:3000#/notebase/nb-1")
  })
})
