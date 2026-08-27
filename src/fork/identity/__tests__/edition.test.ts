import { afterEach, describe, expect, it, vi } from "vitest"
import { currentEdition, DEFAULT_EDITION, resolveEdition } from "../edition"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("resolveEdition（edition 解析）", () => {
  it("未传值 / 空串 → 回落默认 edition cn（未注入与显式空等价）", () => {
    expect(DEFAULT_EDITION).toBe("cn")
    expect(resolveEdition()).toBe("cn")
    expect(resolveEdition("")).toBe("cn")
  })

  it("已知 edition → 原样返回", () => {
    expect(resolveEdition("cn")).toBe("cn")
    expect(resolveEdition("global")).toBe("global")
  })

  it("未知 edition → 抛错且错误信息列出可选值，不静默回落", () => {
    expect(() => resolveEdition("eu")).toThrow(/cn/)
    expect(() => resolveEdition("eu")).toThrow(/global/)
  })
})

describe("currentEdition（构建期注入值）", () => {
  it("未注入 WXT_FORK_EDITION → cn", () => {
    expect(currentEdition()).toBe("cn")
  })

  it("注入 global → 函数内读、运行期改得动（非模块顶层快照）", () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    expect(currentEdition()).toBe("global")
  })

  it("注入未知值 → 抛错", () => {
    vi.stubEnv("WXT_FORK_EDITION", "eu")
    expect(() => currentEdition()).toThrow(/eu/)
  })
})
