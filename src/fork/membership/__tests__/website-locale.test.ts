import { describe, expect, it } from "vitest"
import { uiLanguageToWebsiteLocale, websiteLocalePath } from "../website-locale"

describe("uiLanguageToWebsiteLocale（扩展界面语言 → 官网 locale 段）", () => {
  it("中文映射到官网 zh-hans / zh-hant", () => {
    expect(uiLanguageToWebsiteLocale("zh-CN")).toBe("zh-hans")
    expect(uiLanguageToWebsiteLocale("zh-TW")).toBe("zh-hant")
  })

  it("同名语言直通（ja/ko/es/ru/tr）", () => {
    expect(uiLanguageToWebsiteLocale("ja")).toBe("ja")
    expect(uiLanguageToWebsiteLocale("ko")).toBe("ko")
    expect(uiLanguageToWebsiteLocale("es")).toBe("es")
    expect(uiLanguageToWebsiteLocale("ru")).toBe("ru")
    expect(uiLanguageToWebsiteLocale("tr")).toBe("tr")
  })

  it("默认语言 en → 空段（as-needed 无前缀）", () => {
    expect(uiLanguageToWebsiteLocale("en")).toBe("")
  })

  it("扩展支持但官网未上线的 vi → 回退默认（空段）", () => {
    expect(uiLanguageToWebsiteLocale("vi")).toBe("")
  })

  it("未知值（auto / 任意串）→ 回退默认（空段）", () => {
    expect(uiLanguageToWebsiteLocale("auto")).toBe("")
    expect(uiLanguageToWebsiteLocale("pt-BR")).toBe("")
    expect(uiLanguageToWebsiteLocale("")).toBe("")
  })
})

describe("websiteLocalePath（官网多语言路径拼装，登录/订单共用）", () => {
  it("订单路径 /orders：有 locale 段 → /{locale}/orders", () => {
    expect(websiteLocalePath("zh-CN", "/orders")).toBe("/zh-hans/orders")
    expect(websiteLocalePath("zh-TW", "/orders")).toBe("/zh-hant/orders")
    expect(websiteLocalePath("ja", "/orders")).toBe("/ja/orders")
    expect(websiteLocalePath("ko", "/orders")).toBe("/ko/orders")
    expect(websiteLocalePath("es", "/orders")).toBe("/es/orders")
    expect(websiteLocalePath("ru", "/orders")).toBe("/ru/orders")
    expect(websiteLocalePath("tr", "/orders")).toBe("/tr/orders")
  })

  it("订单路径 /orders：默认语言 en / 未映射 vi → 无前缀 /orders", () => {
    expect(websiteLocalePath("en", "/orders")).toBe("/orders")
    expect(websiteLocalePath("vi", "/orders")).toBe("/orders")
    expect(websiteLocalePath("auto", "/orders")).toBe("/orders")
  })

  it("登录路径等价不变量：websiteLocalePath(l, '/login') 等于原 websiteLoginPath 行为", () => {
    expect(websiteLocalePath("zh-CN", "/login")).toBe("/zh-hans/login")
    expect(websiteLocalePath("zh-TW", "/login")).toBe("/zh-hant/login")
    expect(websiteLocalePath("ja", "/login")).toBe("/ja/login")
    expect(websiteLocalePath("en", "/login")).toBe("/login")
    expect(websiteLocalePath("vi", "/login")).toBe("/login")
    expect(websiteLocalePath("auto", "/login")).toBe("/login")
  })
})
