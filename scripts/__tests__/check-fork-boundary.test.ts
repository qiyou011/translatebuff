import { describe, expect, it } from "vitest"
import { classifyChangedFiles } from "../check-fork-boundary.mjs"

const ALLOW = ["wxt.config.ts", "src/entrypoints/background/index.ts", "src/utils/constants/app.ts"]

describe("classifyChangedFiles", () => {
  it("放行 src/fork 下的文件", () => {
    const { violations } = classifyChangedFiles(["src/fork/ui/popup/App.tsx"], ALLOW)
    expect(violations).toEqual([])
  })

  it("放行 allowlist 内的上游文件", () => {
    const { violations } = classifyChangedFiles(["wxt.config.ts"], ALLOW)
    expect(violations).toEqual([])
  })

  it("标记 allowlist 外被改动的上游文件", () => {
    const { violations } = classifyChangedFiles(["src/utils/message.ts", "src/fork/x.ts"], ALLOW)
    expect(violations).toEqual(["src/utils/message.ts"])
  })

  it("入口 app.tsx 壳层也需在 allowlist 内", () => {
    const { violations } = classifyChangedFiles(["src/entrypoints/popup/app.tsx"], ALLOW)
    expect(violations).toEqual(["src/entrypoints/popup/app.tsx"])
  })
})
