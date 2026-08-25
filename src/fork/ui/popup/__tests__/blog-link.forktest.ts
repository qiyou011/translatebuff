// 博客入口在 fork popup 里是渲染出来的（右上角铃铛），链接必须指向任译喵站点。
// 上游用 `${env.WXT_WEBSITE_URL}${url}` 直拼，本地预览（localhost）时丢掉 hash 路由前缀，联调 404。
// 默认测试环境不是 localhost、两种实现输出一致，所以必须显式把 env 打到 localhost 才命中差异。
import { describe, expect, it, vi } from "vitest"

vi.mock("@/env", () => ({ env: { WXT_WEBSITE_URL: "http://localhost:3000" } }))

describe("fork 博客链接（本地预览）", () => {
  it("走 hash 路由，而非上游直拼", async () => {
    const { buildBlogUrl } = await import("@/fork/ui/popup/blog-url")
    expect(buildBlogUrl("/blog/post-1")).toBe("http://localhost:3000#/blog/post-1")
    expect(buildBlogUrl(undefined)).toBe("http://localhost:3000#/blog")
  })
})
