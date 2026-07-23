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

  it("放行 fork 自有根文件 .env.production", () => {
    const { violations } = classifyChangedFiles([".env.production"], ALLOW)
    expect(violations).toEqual([])
  })

  it("放行 fork 自有根文档 FORK_GUIDE.md / CLAUDE.md", () => {
    const { violations } = classifyChangedFiles(["FORK_GUIDE.md", "CLAUDE.md"], ALLOW)
    expect(violations).toEqual([])
  })

  it("放行 fork 接管的 README（去品牌化后 take-ours）——根 + readmes/ 本地化版", () => {
    const { violations } = classifyChangedFiles(
      ["README.md", "readmes/README.zh-CN.md", "readmes/README.ja.md"],
      ALLOW,
    )
    expect(violations).toEqual([])
  })

  it("放行 fork 修改的根配置 .gitignore", () => {
    const { violations } = classifyChangedFiles([".gitignore"], ALLOW)
    expect(violations).toEqual([])
  })
})
