import { describe, expect, it } from "vitest"
import { computeForkVersion } from "../version"

describe("computeForkVersion", () => {
  it("把 fork build 号作为第 4 段追加", () => {
    expect(computeForkVersion("1.40.2", 3)).toBe("1.40.2.3")
  })

  it("fork build 号为 0（刚跟进上游版本）时用 0", () => {
    expect(computeForkVersion("1.41.0", 0)).toBe("1.41.0.0")
  })

  it("上游版本号非 3 段时抛错", () => {
    expect(() => computeForkVersion("1.40", 1)).toThrow("意外的上游版本号")
  })
})
