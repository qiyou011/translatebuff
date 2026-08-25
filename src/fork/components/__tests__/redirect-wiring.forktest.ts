// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { getWebsiteUrl } from "@/fork/website-url"

// 断言重定向确实把上游模块解析到了 fork 版。只在 vitest.fork.config.ts 下成立，
// 故用 .forktest.ts 扩展名——根配置的默认 include 匹配不到，不会误收。
// 若写成 .test.ts，根配置下上游 openLogIn 用 env 直拼、默认环境里结果与 fork 版一致，
// 会「碰巧通过」，看似有覆盖实则没有。

describe("换皮重定向已接上", () => {
  it("上游 user-account-menu/shared 解析到 fork 版（fork 版的 openLogIn 走 getWebsiteUrl）", async () => {
    const upstream = await import("@/components/user-account-menu/shared")
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    upstream.openLogIn()
    expect(open).toHaveBeenCalledWith(getWebsiteUrl("/log-in"), "_blank")
    open.mockRestore()
  })
})
