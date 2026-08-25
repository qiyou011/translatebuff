// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { openSupportSite } from "@/fork/components/help-button-target"
import { openLogIn, openWebApp } from "@/fork/components/user-account-menu-shared"
import { getWebsiteUrl } from "@/fork/website-url"

// fork 把三个对外链接从上游站点改指任译喵：账号登录、Web 应用、帮助入口。
// 上游 help-button 点开的是 read-frog 的 GitHub issues 列表——那是上游的支持渠道，
// 任译喵用户点进去只会困惑，属「隐藏上游入口」。
describe("fork 品牌链接", () => {
  it("登录与 Web 应用入口指向 fork 站点", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    openLogIn()
    openWebApp()
    expect(open).toHaveBeenNthCalledWith(1, getWebsiteUrl("/log-in"), "_blank")
    expect(open).toHaveBeenNthCalledWith(2, getWebsiteUrl("/home"), "_blank")
    open.mockRestore()
  })

  it("帮助入口指向 fork 站点，不再打开上游 GitHub issues", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    openSupportSite()
    expect(open).toHaveBeenCalledOnce()
    const url = String(open.mock.calls[0]?.[0])
    expect(url).toBe(getWebsiteUrl())
    expect(url).not.toContain("github.com")
    open.mockRestore()
  })
})
