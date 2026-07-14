import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

// 判定改动文件是否越界：允许 src/fork/** 与 allowlist 内的上游文件
export function classifyChangedFiles(changed, allowlist) {
  const allow = new Set(allowlist)
  const violations = changed.filter((f) => {
    if (f.startsWith("src/fork/")) return false
    if (f.startsWith("scripts/") || f.startsWith("docs/") || f === "FORK.md") return false
    if (f.startsWith("openspec/") || f.startsWith(".github/")) return false
    return !allow.has(f)
  })
  return { violations }
}

// 仅在直接运行时执行 git diff 检查（被测试 import 时不触发）
if (import.meta.url === `file://${process.argv[1]}`) {
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
