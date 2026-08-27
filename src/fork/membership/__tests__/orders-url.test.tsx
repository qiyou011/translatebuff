// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { useOpenForkOrders } from "../atoms"

// 只挡 i18n 门面：它顶层 import src/locales/*.yml，而根 vitest 配置不带 ViteYaml 插件（全仓无先例）。
// 顺带把「界面语言 → locale」的归一结果做成可控值，好逐个 locale 断言 URL。
// URL 装配本身——官网域、locale 前缀、edition 路径、cid——全部走真实实现，不被 mock 遮住。
const locale = vi.hoisted(() => ({ current: "en" }))
vi.mock("@/utils/i18n/locale-map", () => ({
  resolveUiLocale: () => locale.current,
}))

// 订单跳转的完整 URL 装配，断言的是真正传给 browser.tabs.create 的那个串——
// 路径表接错、前缀拼反、cid 丢了都会在这里失败。
describe("useOpenForkOrders（订单页跳转 URL）", () => {
  beforeEach(() => {
    browser.tabs.create = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    locale.current = "en"
  })

  function openedUrl(): string {
    const { result } = renderHook(() => useOpenForkOrders())
    result.current()
    return (browser.tabs.create as any).mock.calls[0][0].url
  }

  function stubGlobalEdition(): void {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    vi.stubEnv("WXT_FORK_CHANNEL", "global-zip")
  }

  it("cn 线 + 英文界面 → /orders（无 locale 前缀），带 cid", () => {
    const url = openedUrl()
    expect(url).toContain("/orders")
    expect(url).not.toContain("/account/orders")
    expect(url).toContain("cid=7100")
  })

  it("cn 线 + 简体中文 → /zh-hans/orders（本变更前的行为逐字不变）", () => {
    locale.current = "zh-CN"
    expect(openedUrl()).toContain("/zh-hans/orders")
  })

  it("global 线 → 订单落在账户中心下 /account/orders，cid 取海外渠道号", () => {
    stubGlobalEdition()
    const url = openedUrl()
    expect(url).toContain("/account/orders")
    expect(url).toContain("cid=7150")
  })

  it("global 线 + 简体中文 → locale 前缀在最前：/zh-hans/account/orders", () => {
    stubGlobalEdition()
    locale.current = "zh-CN"
    const url = openedUrl()
    expect(url).toContain("/zh-hans/account/orders")
    expect(url).not.toContain("/account/zh-hans/orders")
  })

  it("global 线 + 官网未上线的语言（vi）→ 回退无前缀，不拼出 404 路径", () => {
    stubGlobalEdition()
    locale.current = "vi"
    const url = openedUrl()
    expect(url).toContain("/account/orders")
    expect(url).not.toContain("/vi/")
  })
})
