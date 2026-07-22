import { describe, expect, it } from "vitest"
import { maskPhone } from "../phone-mask"

describe("maskPhone（手机号脱敏展示，对齐官网风格）", () => {
  it("带 +86- 前缀：区号（去连字符）+ **** + 后 4 位，不露首位", () => {
    expect(maskPhone("+86-13800138000")).toBe("+86****8000")
  })

  it("无前缀纯号码：**** + 后 4 位", () => {
    expect(maskPhone("13800138000")).toBe("****8000")
  })

  it("空串 → 空串（未登录/缺手机号）", () => {
    expect(maskPhone("")).toBe("")
  })

  it("号码过短（≤4 位）→ 全遮、不暴露任何位", () => {
    expect(maskPhone("+86-123")).toBe("+86****")
    expect(maskPhone("123")).toBe("****")
  })
})
