import { describe, expect, it } from "vitest"
import { computeForkVersion, computeForkVersionName } from "../version"

describe("computeForkVersion", () => {
  it("正式版本原样返回 3 段 semver", () => {
    expect(computeForkVersion("1.0.0")).toBe("1.0.0")
  })

  it("非 3 段数字版本号抛错", () => {
    expect(() => computeForkVersion("1.0")).toThrow("意外的 fork 版本号")
  })
})

describe("computeForkVersionName", () => {
  it("拼中文品牌 + 正式版本 + 上游基线溯源", () => {
    expect(computeForkVersionName("1.42.2", "1.0.0", "任译喵")).toBe("任译喵 1.0.0（rf 1.42.2）")
  })

  it("上游版本串异常也不抛错、原样透传（不拖垮构建）", () => {
    expect(computeForkVersionName("1.43.0-beta.1", "1.0.0", "任译喵")).toBe(
      "任译喵 1.0.0（rf 1.43.0-beta.1）",
    )
  })

  it("fork 自身版本非法仍抛错", () => {
    expect(() => computeForkVersionName("1.42.2", "1.0", "任译喵")).toThrow("意外的 fork 版本号")
  })
})
