import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { cpSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const sha = (value) => createHash("sha256").update(value).digest("hex")
function digest(root) {
  const files = []
  function walk(directory, prefix = "") {
    for (const name of readdirSync(directory).sort()) {
      const path = resolve(directory, name)
      const relative = prefix ? `${prefix}/${name}` : name
      if (statSync(path).isDirectory()) walk(path, relative)
      else
        files.push({ path: relative, bytes: statSync(path).size, sha256: sha(readFileSync(path)) })
    }
  }
  walk(root)
  return { files, treeSha256: sha(JSON.stringify(files)) }
}
const preserved = [
  [".output/chrome-mv3-global", "ea567267f98550bfee72788d6e1e9e2e13e612ee2db28f5e4adc0d07f54f48d6"],
  [
    ".output/layout-fix/chrome-mv3-global",
    "6fb916949bfa25b7cc379096acb36cfd227d455e2d0cd5184b7699ab86eeb6fd",
  ],
  [
    ".output/switch-fix/chrome-mv3-global",
    "407fbe95a5c805ffaa72758ea904c6e489e74164d1f94fabc01fba2f7140fb3f",
  ],
  [
    ".output/selection-settings-fix/chrome-mv3-global",
    "105f3874cdca052d34eb5eed1576a201112f36e7e772aaabb67999f20683b9ac",
  ],
]
for (const [path, expected] of preserved) assert.equal(digest(path).treeSha256, expected, path)
const previous = preserved.at(-1)
const built = resolve(".output/merge-regression-fix/chrome-mv3-global")
const current = digest(built)
const destination = "/Users/yisen/Downloads/TranslateBuff-Global-1.5.0-rf1.51.0-20261015"
assert.equal(
  digest(destination).treeSha256,
  previous[1],
  "Installed directory changed; preserve it",
)
assert.deepEqual(
  JSON.parse(readFileSync(resolve(destination, "manifest.json"), "utf8")),
  JSON.parse(readFileSync(resolve(built, "manifest.json"), "utf8")),
)

// Compare emitted public configuration without writing its values into evidence.
function environmentStrings(directory, files) {
  const values = new Map()
  for (const file of files.filter((item) => item.path.endsWith(".js"))) {
    const js = readFileSync(resolve(directory, file.path), "utf8")
    for (const match of js.matchAll(/\b(WXT_[A-Z_]+)\s*:\s*(["'`])([^"'`]+)\2/g)) {
      const set = values.get(match[1]) ?? new Set()
      set.add(sha(match[3]))
      values.set(match[1], set)
    }
  }
  return Object.fromEntries(
    [...values.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, hashes]) => [key, [...hashes].sort((left, right) => left.localeCompare(right))]),
  )
}
const priorConfig = environmentStrings(destination, digest(destination).files)
const newConfig = environmentStrings(built, current.files)
assert.ok(Object.keys(priorConfig).length >= 10, "Expected embedded edition configuration")
assert.deepEqual(newConfig, priorConfig, "Embedded global production settings changed")

const backup = `${destination}-selection-settings-105f3874-${randomUUID().slice(0, 8)}`
const staged = `${destination}-merge-regression-staged-${randomUUID().slice(0, 8)}`
cpSync(built, staged, { recursive: true })
assert.equal(digest(staged).treeSha256, current.treeSha256)
renameSync(destination, backup)
try {
  renameSync(staged, destination)
} catch (error) {
  renameSync(backup, destination)
  throw error
}
assert.equal(digest(destination).treeSha256, current.treeSha256)
const sources = [
  "src/fork/ui/options/options-theme.css",
  "src/fork/ui/options/custom-actions-theme.css",
  "src/fork/ui/options/note-suggestion-items.tsx",
  "src/components/ui/base-ui/switch.tsx",
  "src/fork/ui/selection-content/SelectionToolbar.tsx",
  "src/fork/ui/popup/providers-field.tsx",
  "src/entrypoints/options/pages/custom-actions/action-config-form/layout-field.tsx",
  "wxt.config.ts",
]
const report = {
  status: "UPDATED_SAME_DIRECTORY_AWAITING_USER_RELOAD",
  sourceHead: "e1d90dc928ca5fbbbba112e480131e1c909c93ce",
  sourceWorkingTreeDirty: true,
  preserved: preserved.map(([path, treeSha256]) => ({ path, treeSha256 })),
  previousTreeSha256: previous[1],
  currentTreeSha256: current.treeSha256,
  manifestUnchanged: true,
  embeddedConfigurationNames: Object.keys(newConfig),
  embeddedConfigurationHashesEqual: true,
  destination,
  backup,
  buildDirectory: built,
  files: current.files,
  sourceHashes: Object.fromEntries(sources.map((path) => [path, sha(readFileSync(path))])),
  browserProfileOrSettingsModified: false,
  actualExtensionNewRuntimeVerified: false,
}
writeFileSync(
  resolve("openspec/changes/upstream-sync-v1-51-0/evidence/merge-regression-sweep/artifact.json"),
  `${JSON.stringify(report, null, 2)}\n`,
)
console.log(
  JSON.stringify({
    status: report.status,
    treeSha256: current.treeSha256,
    files: current.files.length,
    configurationNames: report.embeddedConfigurationNames.length,
    backup,
  }),
)
