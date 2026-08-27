import { describe, expect, it } from "vitest"
import { maskEmail } from "../email-mask"

describe("maskEmail（海外线身份展示）", () => {
  it("保留用户名首字符与完整域名（对齐官网 format.ts 的展示效果）", () => {
    expect(maskEmail("alice@gmail.com")).toBe("a***@gmail.com")
  })

  it("用户名仅 1 位时仍只保留首字符，不多暴露", () => {
    expect(maskEmail("a@b.com")).toBe("a***@b.com")
  })

  it("空串 → 空串（官网那版会得到 '***'，此处补齐）", () => {
    expect(maskEmail("")).toBe("")
  })

  it("无 @ 的畸形输入 → 全遮，绝不泄漏任何位", () => {
    // 官网那版 indexOf 返 -1、slice(-1) 取末字符，alice 会变成 "a***e"。
    expect(maskEmail("alice")).toBe("***")
  })

  it("@ 开头的畸形输入 → 全遮", () => {
    expect(maskEmail("@gmail.com")).toBe("***")
  })
})
