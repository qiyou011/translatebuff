import { describe, expect, it } from "vitest"
import { classifyChangedFiles, resolveSyncBase } from "../check-fork-boundary.mjs"

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

// ── 同步模式基准推导 ────────────────────────────────────────────────────────
// 同步分支合完上游后，三点差集等于全量上游改动（阶段 1 是 290 个文件，阶段 2 是 800 个），
// 用增量模式会把同步 PR 自己判红。故基准必须取「本次合并进来的上游提交」。
//
// 不能用 git rev-parse HEAD^2：CI 里 actions/checkout 在 pull_request 下检出的是
// GitHub 合成的 refs/pull/N/merge，其第二父是 PR 分支 tip → 差集近乎为空 → 空转恒绿。

/** 造一个假 git：按 argv 前缀查表返回 stdout，未登记的命令抛错（模拟 git 非零退出） */
function fakeGit(table: Record<string, string>) {
  return (args: string[]) => {
    const key = args.join(" ")
    if (!(key in table)) {
      throw new Error(`git ${key} failed`)
    }
    return table[key]
  }
}

const BASE_REF = "change/fork-foundation"

describe("resolveSyncBase", () => {
  it("取最近一个「第二父不是 base 分支祖先」的 merge 的第二父", () => {
    const git = fakeGit({
      // 两个 merge：先是跟 base（第二父 = base tip），再往前是合上游
      "log --merges --format=%H %P HEAD": "mmm1 p0 basetip\nmmm2 p1 upstreamsha",
      "merge-base --is-ancestor basetip origin/change/fork-foundation": "",
      "merge-base --is-ancestor upstreamsha HEAD": "",
    })
    expect(resolveSyncBase(git, BASE_REF)).toBe("upstreamsha")
  })

  it("HEAD 不是合并提交且未给显式基准时，报错退出而不是回落增量模式", () => {
    const git = fakeGit({ "log --merges --format=%H %P HEAD": "" })
    expect(() => resolveSyncBase(git, BASE_REF)).toThrow(/推导不出同步基准/)
  })

  it("显式基准等于 base 分支 tip 时判为无效", () => {
    const git = fakeGit({
      "merge-base --is-ancestor basetip HEAD": "",
      "merge-base --is-ancestor basetip origin/change/fork-foundation": "",
    })
    expect(() => resolveSyncBase(git, BASE_REF, "basetip")).toThrow(/base 分支上已有的提交/)
  })

  it("显式基准不是 HEAD 祖先时判为无效", () => {
    const git = fakeGit({})
    expect(() => resolveSyncBase(git, BASE_REF, "dangling")).toThrow(/不是 HEAD 的祖先/)
  })

  it("显式基准通过两条校验时原样返回", () => {
    const git = fakeGit({ "merge-base --is-ancestor upstreamsha HEAD": "" })
    expect(resolveSyncBase(git, BASE_REF, "upstreamsha")).toBe("upstreamsha")
  })

  it("同步模式不改变 classifyChangedFiles 的判定语义", () => {
    const changed = ["src/utils/message.ts", "src/fork/x.ts"]
    expect(classifyChangedFiles(changed, ALLOW).violations).toEqual(["src/utils/message.ts"])
  })
})

describe("fork 自有根文件", () => {
  it("放行 .gitattributes 与 vitest.fork.config.ts", () => {
    const { violations } = classifyChangedFiles([".gitattributes", "vitest.fork.config.ts"], ALLOW)
    expect(violations).toEqual([])
  })
})

describe("fork 品牌资源替换", () => {
  it("逐条登记的资源被放行", () => {
    const allow = ["public/icon/128.png", "assets/banner.png", "src/assets/demo/context-menu.png"]
    const { violations } = classifyChangedFiles(allow, allow)
    expect(violations).toEqual([])
  })

  it("同目录下的源文件不因资源登记而被放行", () => {
    // 刻意不用目录前缀放行：前缀会让日后往 src/assets/ 丢一个 .ts 被静默放过
    const { violations } = classifyChangedFiles(
      ["src/assets/styles/theme.css"],
      ["src/assets/demo/context-menu.png"],
    )
    expect(violations).toEqual(["src/assets/styles/theme.css"])
  })
})

// ── 回退到上游不算越界 ──────────────────────────────────────────────────────
// 护栏原本只问「这次改动碰了哪些文件」，于是「把 fork 的原地改动退回上游版本」也被判越界——
// 清理历史欠债的 PR 注定过不了自己的门禁。判定应看**与上游是否还有分歧**：
// 改完之后内容与上游一致 = fork 在该文件上零分歧 = 不是越界。
describe("classifyChangedFiles 的分歧判定", () => {
  it("回退到上游版本的文件不判越界", () => {
    const { violations } = classifyChangedFiles(
      ["src/utils/message.ts"],
      [],
      // 该文件改完后与上游一致
      (file) => file !== "src/utils/message.ts",
    )
    expect(violations).toEqual([])
  })

  it("仍与上游有分歧的文件照判越界", () => {
    const { violations } = classifyChangedFiles(["src/utils/message.ts"], [], () => true)
    expect(violations).toEqual(["src/utils/message.ts"])
  })

  it("不传分歧判定时行为不变（默认一律视为有分歧）", () => {
    const { violations } = classifyChangedFiles(["src/utils/message.ts"], [])
    expect(violations).toEqual(["src/utils/message.ts"])
  })
})
