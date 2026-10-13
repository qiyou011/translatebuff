// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { env } from "@/env"
import { resolveChannelNumber } from "@/fork/identity/channel"
import { useOpenForkLogin, useOpenForkOrders } from "../atoms"

// 只挡 i18n 门面：它顶层 import src/locales/*.yml，而根 vitest 配置不带 ViteYaml 插件（全仓无先例）。
// 顺带把「界面语言 → locale」的归一结果做成可控值，好逐个 locale 断言 URL。
// URL 装配本身——官网域、locale 前缀、edition 路径、cid——全部走真实实现，不被 mock 遮住。
const locale = vi.hoisted(() => ({ current: "en" }))
const sendForkMessage = vi.hoisted(() => vi.fn<() => Promise<string>>().mockResolvedValue("7150"))
vi.mock("@/fork/message", () => ({ sendForkMessage, onForkMessage: vi.fn<() => void>() }))
vi.mock("@/utils/i18n/locale-map", () => ({
  resolveUiLocale: () => locale.current,
}))

// 订单跳转的完整 URL 装配，断言的是真正传给 browser.tabs.create 的那个串——
// 路径表接错、前缀拼反、cid 丢了都会在这里失败。
describe("useOpenForkOrders（订单页跳转 URL）", () => {
  beforeEach(() => {
    browser.tabs.create = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
    sendForkMessage.mockReset().mockImplementation(async () => resolveChannelNumber())
    vi.spyOn(browser.cookies, "get").mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    locale.current = "en"
  })

  async function openedUrl(): Promise<string> {
    const { result } = renderHook(() => useOpenForkOrders())
    result.current()
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(1))
    return (browser.tabs.create as any).mock.calls[0][0].url
  }

  function stubGlobalEdition(): void {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    vi.stubEnv("WXT_FORK_CHANNEL", "global-zip")
  }

  it("cn 线 + 英文界面 → /orders（无 locale 前缀），带 cid", async () => {
    const url = await openedUrl()
    expect(url).toContain("/orders")
    expect(url).not.toContain("/account/orders")
    expect(url).toContain("cid=7100")
  })

  it("cn 线 + 简体中文 → /zh-hans/orders（本变更前的行为逐字不变）", async () => {
    locale.current = "zh-CN"
    expect(await openedUrl()).toContain("/zh-hans/orders")
  })

  it("global 线 → 订单落在账户中心下 /account/orders，cid 取海外渠道号", async () => {
    stubGlobalEdition()
    const url = await openedUrl()
    expect(url).toContain("/account/orders")
    expect(url).toContain("cid=7150")
  })

  it("global 线 + 简体中文 → locale 前缀在最前：/zh-hans/account/orders", async () => {
    stubGlobalEdition()
    locale.current = "zh-CN"
    const url = await openedUrl()
    expect(url).toContain("/zh-hans/account/orders")
    expect(url).not.toContain("/account/zh-hans/orders")
  })

  it("global 线 + 官网未上线的语言（vi）→ 回退无前缀，不拼出 404 路径", async () => {
    stubGlobalEdition()
    locale.current = "vi"
    const url = await openedUrl()
    expect(url).toContain("/account/orders")
    expect(url).not.toContain("/vi/")
  })

  it.each(["cn", "global"])("%s 登录与订单每次读取当前 Cookie 渠道", async (edition) => {
    if (edition === "global") stubGlobalEdition()
    sendForkMessage.mockResolvedValue("9899")
    const login = renderHook(() => useOpenForkLogin())
    login.result.current()
    await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(1))
    expect((browser.tabs.create as any).mock.calls[0][0].url).toContain("cid=9899")
    vi.mocked(browser.tabs.create).mockClear()
    sendForkMessage.mockResolvedValue("66666")
    const orders = await openedUrl()
    expect(orders).toContain("cid=66666")
  })

  it("后台消息不可用时直接读取当前 Cookie，清除后回包内号而不是旧快照", async () => {
    stubGlobalEdition()
    sendForkMessage.mockRejectedValue(new Error("worker unavailable"))
    vi.spyOn(browser.storage.local, "get").mockResolvedValue({
      fork_install_channel_v1: {
        version: 1,
        installAt: 101,
        selectedCid: "7154",
        websiteOrigin: new URL(env.WXT_WEBSITE_URL).origin,
      },
    } as never)
    vi.mocked(browser.cookies.get).mockResolvedValue({ value: "9899" } as never)
    expect(await openedUrl()).toContain("cid=9899")
    vi.mocked(browser.tabs.create).mockClear()
    vi.mocked(browser.cookies.get).mockResolvedValue(undefined)
    expect(await openedUrl()).toContain("cid=7150")
  })
})
