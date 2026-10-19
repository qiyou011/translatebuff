import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import nodePath from "node:path"
import { Script } from "node:vm"
const repo = process.cwd()
const relativeFile = "src/fork/__tests__/upstream-v151-migration.test.ts"
const source = process.argv[2]
  ? execFileSync("git", ["show", `${process.argv[2]}:${relativeFile}`], {
      cwd: repo,
      encoding: "utf8",
    })
  : readFileSync(nodePath.join(repo, relativeFile), "utf8")
const baseline = source.match(/const BASE = "([0-9a-f]+)"/)[1]
const legacyPaths = new Set(
  execFileSync("git", ["ls-tree", "-r", "--name-only", baseline], { cwd: repo, encoding: "utf8" })
    .trim()
    .split("\n"),
)
// Execute the actual legacyRequire source, not a reimplementation of its path
// algorithm. esbuild only erases TypeScript, as in the existing pinned loader.
const begin = source.indexOf("const legacyRequire = ")
const end = source.indexOf("\n  const legacyGlob", begin)
assert(begin >= 0 && end > begin, "actual resolver source must be found")
const actualDeclaration = source.slice(begin, end)
const repoRequire = createRequire(nodePath.join(repo, "package.json"))
const { transformSync } = createRequire(repoRequire.resolve("wxt"))("esbuild")
const declaration = transformSync(actualDeclaration, {
  loader: "ts",
  format: "cjs",
  target: "es2022",
}).code
// As in the pinned loader, only trusted repository source is evaluated.
const evaluate = new Script(
  `(function(dirname, join, normalize, posix, path, legacyPaths, legacyModule, require) {\n${declaration}\nreturn legacyRequire\n})`,
).runInThisContext()
const cases = [
  [
    "win32",
    "src/types/config/provider/index.ts",
    "./constants",
    "src/types/config/provider/constants.ts",
  ],
  ["win32", "src/types/config/config.ts", "./provider", "src/types/config/provider/index.ts"],
  ["win32", "src/types/config/provider/index.ts", "../config", "src/types/config/config.ts"],
  [
    "win32",
    "src/types/config/provider/index.ts",
    "@/types/config/provider/constants",
    "src/types/config/provider/constants.ts",
  ],
  [
    "posix",
    "src/types/config/provider/index.ts",
    "./constants",
    "src/types/config/provider/constants.ts",
  ],
  ["posix", "src/types/config/config.ts", "./provider", "src/types/config/provider/index.ts"],
]
const rows = cases.map(([nativeApi, caller, specifier, expected]) => {
  assert(legacyPaths.has(expected), `pinned file must really exist: ${expected}`)
  const api = nodePath[nativeApi]
  const resolver = evaluate(
    api.dirname,
    api.join,
    api.normalize,
    nodePath.posix,
    caller,
    legacyPaths,
    (id) => id,
    repoRequire,
  )
  let actual = null,
    error = null,
    status = "passed"
  try {
    actual = resolver(specifier)
  } catch (caught) {
    error = caught.message
  }
  try {
    assert.equal(actual, expected)
  } catch {
    status = "failed"
  }
  return { nativeApi, caller, specifier, expected, actual, error, status }
})
const failed = rows.filter((row) => row.status === "failed").length
console.log(
  JSON.stringify(
    {
      platform: process.platform,
      testFile: relativeFile,
      baseline,
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      actualLegacyRequireExecuted: true,
      pinnedPathCount: legacyPaths.size,
      passed: rows.length - failed,
      failed,
      rows,
    },
    null,
    2,
  ),
)
process.exitCode = failed ? 1 : 0
