import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const { classifyChangedFiles } = await import(
  pathToFileURL(resolve("scripts/check-fork-boundary.mjs"))
)
const gitPaths = (args) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\0").filter(Boolean)
const paths = [
  ...new Set([
    ...gitPaths(["diff", "--name-only", "-z", "HEAD"]),
    ...gitPaths(["ls-files", "--others", "--exclude-standard", "-z"]),
  ]),
].sort()
const allowlist = JSON.parse(readFileSync("scripts/fork-allowlist.json", "utf8")).files
const result = classifyChangedFiles(paths, allowlist)
writeFileSync(
  resolve(
    "openspec/changes/upstream-sync-v1-51-0/evidence/merge-regression-sweep/working-tree-boundary.json",
  ),
  JSON.stringify(
    {
      scope:
        "All dirty tracked and nonignored untracked files, supplementing HEAD-only fixed-SHA guard",
      paths,
      ...result,
    },
    null,
    2,
  ),
)
assert.deepEqual(result.violations, [])
console.log(JSON.stringify({ status: "PASS", files: paths.length, violations: 0 }))
