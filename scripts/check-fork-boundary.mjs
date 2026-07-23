import { execSync } from "node:child_process"
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
])

// 判定改动文件是否越界：允许 src/fork/** 与 allowlist 内的上游文件
export function classifyChangedFiles(changed, allowlist) {
  const allow = new Set(allowlist)
  const violations = changed.filter((f) => {
    if (f.startsWith("src/fork/")) return false
    if (f.startsWith("scripts/") || f.startsWith("docs/")) return false
    if (f.startsWith("openspec/") || f.startsWith(".github/")) return false
    // fork 接管的 README（去品牌化后 fork 独占、同步 take-ours）：上游有同名文件但内容归 fork
    if (f === "README.md" || f.startsWith("readmes/")) return false
    if (FORK_ROOT_FILES.has(f)) return false
    return !allow.has(f)
  })
  return { violations }
}

// 仅在直接运行时执行 git diff 检查（被测试 import 时不触发；兼容 Windows 路径）
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.env.FORK_DIFF_BASE ?? "origin/main"
  const changed = execSync(`git diff --name-only ${base}...HEAD`, { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
  const allowlist = JSON.parse(readFileSync("scripts/fork-allowlist.json", "utf8")).files
  const { violations } = classifyChangedFiles(changed, allowlist)
  if (violations.length > 0) {
    console.error("Fork boundary violations (edit src/fork/** or add to allowlist after review):")
    for (const v of violations) console.error(`  - ${v}`)
    process.exit(1)
  }
  console.log("Fork boundary OK")
}
