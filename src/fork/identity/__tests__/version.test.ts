import { describe, expect, it } from "vitest"
import { computeForkVersion, computeForkVersionName } from "../version"

describe("computeForkVersion", () => {
  it("预发布用 0.0.<forkBuild> 三段版本", () => {
    expect(computeForkVersion(1)).toBe("0.0.1")
  })

  it("fork build 号递增反映在第 3 段", () => {
    expect(computeForkVersion(2)).toBe("0.0.2")
  })
})

describe("computeForkVersionName", () => {
  it("拼中文品牌 + 预发布版本 + 上游基线溯源", () => {
    expect(computeForkVersionName("1.40.2", 1, "任译喵")).toBe("任译喵 0.0.1（rf 1.40.2）")
  })

  it("上游版本号非 3 段时抛错", () => {
    expect(() => computeForkVersionName("1.40", 1, "任译喵")).toThrow("意外的上游版本号")
  })
})
