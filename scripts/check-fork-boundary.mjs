import { execFileSync, execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

// fork 净新增/自有的根级 meta 文件：上游永不创建，属 fork 所有，放行不判越界
const FORK_ROOT_FILES = new Set([
  "FORK.md",
  "FORK_GUIDE.md",
  "CLAUDE.md",
  ".env.production",
  ".env",
  ".gitignore",
  ".gitattributes",
  "vitest.fork.config.ts",
])

/**
 * 判定改动文件是否越界：允许 src/fork/** 与 allowlist 内的上游文件。
 *
 * @param divergesFromUpstream 可选。判断某文件改完之后是否**仍与上游有分歧**。
 *   不传时一律视为有分歧（保持旧行为）。传了的话，把 fork 的原地改动退回上游版本
 *   就不再判越界——否则清理历史欠债的 PR 会被自己的门禁拦死：它做的正是「消除分歧」，
 *   而旧判定只问「碰没碰过这个文件」。
 */
export function classifyChangedFiles(changed, allowlist, divergesFromUpstream) {
  const allow = new Set(allowlist)
  const violations = changed.filter((f) => {
    if (f.startsWith("src/fork/")) return false
    if (f.startsWith("scripts/") || f.startsWith("docs/")) return false
    if (f.startsWith("openspec/") || f.startsWith(".github/")) return false
    // fork 接管的 README（去品牌化后 fork 独占、同步 take-ours）：上游有同名文件但内容归 fork
    if (f === "README.md" || f.startsWith("readmes/")) return false
    if (FORK_ROOT_FILES.has(f)) return false
    if (allow.has(f)) return false
    // 改完与上游一致 = fork 在该文件上零分歧，不是越界
    return divergesFromUpstream ? divergesFromUpstream(f) : true
  })
  return { violations }
}

/**
 * 推导同步模式的基准 = 本次合并进来的上游提交。
 *
 * 不能用 `git rev-parse HEAD^2`：CI 里 actions/checkout 在 pull_request 事件下检出的是
 * GitHub 合成的 refs/pull/N/merge，其第二父是 PR 分支 tip 而非上游提交——取它会让三点差集
 * 近乎为空，边界检查空转恒绿（门禁看着过了其实一个文件没查，比全判红更难发现）。本地跑到
 * 门禁那步时 HEAD 通常也已不是合并提交，而长同步里中途跟一次 base 还会污染第二父。
 *
 * 所以改为：取本分支上最近一个「第二父不是 base 分支祖先」的 merge 提交的第二父，
 * 或由调用方显式给定；两条路径都过同样的校验。推导或校验失败一律抛错，绝不回落增量模式。
 *
 * @param git 执行 git 的回调，非零退出时抛错（便于测试注入假实现）
 */
export function resolveSyncBase(git, baseRef, explicitBase) {
  const isAncestor = (sha, ref) => {
    try {
      git(["merge-base", "--is-ancestor", sha, ref])
      return true
    } catch {
      return false
    }
  }
  const validate = (sha) => {
    if (!isAncestor(sha, "HEAD")) {
      throw new Error(`同步基准 ${sha} 不是 HEAD 的祖先，无法作为差集起点`)
    }
    if (isAncestor(sha, `origin/${baseRef}`)) {
      throw new Error(
        `同步基准 ${sha} 是 base 分支上已有的提交，差集会漏掉全部上游改动；请指向本次合并进来的上游提交`,
      )
    }
    return sha
  }

  if (explicitBase) {
    return validate(explicitBase)
  }

  const log = git(["log", "--merges", "--format=%H %P", "HEAD"]).trim()
  for (const line of log.split("\n")) {
    const secondParent = line.trim().split(/\s+/)[2]
    if (!secondParent) continue
    // 跟 base 分支的 merge：第二父是 base 分支上的提交，跳过
    if (isAncestor(secondParent, `origin/${baseRef}`)) continue
    return validate(secondParent)
  }
  throw new Error(
    "推导不出同步基准：本分支上找不到「第二父不是 base 分支祖先」的合并提交。" +
      "请显式指定 FORK_SYNC_BASE=<上游落脚点 SHA>",
  )
}

// 仅在直接运行时执行 git diff 检查（被测试 import 时不触发；兼容 Windows 路径）
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // 用 execFileSync 而非拼 shell 字符串：--format=%H %P 含空格，拼字符串会被 shell
  // 拆成两个参数，git 报错而不是返回结果——那会让「推导不出基准」这个正常分支
  // 变成一条看不懂的 Command failed。
  const git = (args) =>
    execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })

  // 三种基准模式，语义各不相同，混用会让门禁要么全判红、要么空转恒绿：
  //   增量（默认）  origin/<base_ref>        差集 = 本次 PR 自己改了什么
  //   同步          本次合并进来的上游提交    差集 = fork 相对上游的自有改动
  //   排查          分叉点（不参与 CI 判定）  差集 = 累计欠账
  let base
  if (process.env.FORK_SCAN_ALL === "1") {
    base = JSON.parse(readFileSync("src/fork/identity/upstream-baseline.json", "utf8")).forkPointSha
  } else if (process.env.FORK_SYNC_MODE === "1") {
    // 推导/校验失败一律硬失败退出，绝不回落增量模式——静默降级等同于不做检查。
    try {
      base = resolveSyncBase(
        git,
        process.env.FORK_BASE_REF ?? "change/fork-foundation",
        process.env.FORK_SYNC_BASE,
      )
    } catch (error) {
      console.error(`Fork boundary check aborted (sync mode): ${error.message}`)
      process.exit(1)
    }
    console.log(`Sync mode: base = ${base}`)
  } else {
    base = process.env.FORK_DIFF_BASE ?? "origin/main"
  }

  const changed = execSync(`git diff --name-only ${base}...HEAD`, { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
  const allowlist = JSON.parse(readFileSync("scripts/fork-allowlist.json", "utf8")).files

  // 分歧基准取上游落脚点：排查/同步模式下 base 本身就是上游提交；增量模式下 base 是 fork
  // 的长期分支，得另取 upstream-baseline.json 的 lastSyncedSha。
  const upstreamRef =
    process.env.FORK_SCAN_ALL === "1" || process.env.FORK_SYNC_MODE === "1"
      ? base
      : JSON.parse(readFileSync("src/fork/identity/upstream-baseline.json", "utf8")).lastSyncedSha
  const divergesFromUpstream = (file) => {
    const diff = execFileSync("git", ["diff", "--name-only", upstreamRef, "HEAD", "--", file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    return diff.trim() !== ""
  }

  const { violations } = classifyChangedFiles(changed, allowlist, divergesFromUpstream)
  if (violations.length > 0) {
    console.error("Fork boundary violations (edit src/fork/** or add to allowlist after review):")
    for (const v of violations) console.error(`  - ${v}`)
    process.exit(1)
  }
  console.log("Fork boundary OK")
}
