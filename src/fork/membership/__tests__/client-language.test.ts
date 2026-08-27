import { describe, expect, it } from "vitest"
import { DEFAULT_CLIENT_LANGUAGE, toClientLanguage } from "../client-language"

describe("toClientLanguage（界面语言 → 后端 Client-Language 头）", () => {
  it("已实测确认后端有译文的语种逐条映射", () => {
    expect(toClientLanguage("en")).toBe("en-us")
    expect(toClientLanguage("zh-CN")).toBe("zh-cn")
    expect(toClientLanguage("zh-TW")).toBe("zh-tw")
    expect(toClientLanguage("ja")).toBe("ja-jp")
    expect(toClientLanguage("ru")).toBe("ru-ru")
  })

  it("未收录语种一律回落 en-us，不猜 es-es / ko-kr 这类未实测取值", () => {
    expect(DEFAULT_CLIENT_LANGUAGE).toBe("en-us")
    for (const locale of ["es", "ko", "tr", "vi", "pt", "auto", "", "zh"]) {
      expect(toClientLanguage(locale)).toBe("en-us")
    }
  })

  it("取值恒为 <语言>-<地区> 两段小写且不含 /（UA 七段与请求头约束）", () => {
    for (const locale of ["en", "zh-CN", "zh-TW", "ja", "ru", "es", "unknown"]) {
      expect(toClientLanguage(locale)).toMatch(/^[a-z]{2}-[a-z]{2}$/)
    }
  })
})
