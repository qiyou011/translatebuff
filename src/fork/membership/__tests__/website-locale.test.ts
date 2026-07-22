import { describe, expect, it } from "vitest"
import { uiLanguageToWebsiteLocale, websiteLoginPath } from "../website-locale"

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

describe("websiteLoginPath（官网登录路径拼装）", () => {
  it("有 locale 段 → /{locale}/login", () => {
    expect(websiteLoginPath("zh-CN")).toBe("/zh-hans/login")
    expect(websiteLoginPath("zh-TW")).toBe("/zh-hant/login")
    expect(websiteLoginPath("ja")).toBe("/ja/login")
  })

  it("默认语言 / 回退 → /login（无 locale 前缀）", () => {
    expect(websiteLoginPath("en")).toBe("/login")
    expect(websiteLoginPath("vi")).toBe("/login")
    expect(websiteLoginPath("auto")).toBe("/login")
  })
})
