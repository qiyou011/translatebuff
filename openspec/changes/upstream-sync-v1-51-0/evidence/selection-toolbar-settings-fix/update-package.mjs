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
const frozen = digest(".output/chrome-mv3-global")
const layout = digest(".output/layout-fix/chrome-mv3-global")
assert.equal(frozen.treeSha256, "ea567267f98550bfee72788d6e1e9e2e13e612ee2db28f5e4adc0d07f54f48d6")
assert.equal(layout.treeSha256, "6fb916949bfa25b7cc379096acb36cfd227d455e2d0cd5184b7699ab86eeb6fd")
const previous = digest(".output/switch-fix/chrome-mv3-global")
assert.equal(
  previous.treeSha256,
  "407fbe95a5c805ffaa72758ea904c6e489e74164d1f94fabc01fba2f7140fb3f",
)
const built = resolve(".output/selection-settings-fix/chrome-mv3-global")
const current = digest(built)
const destination = "/Users/yisen/Downloads/TranslateBuff-Global-1.5.0-rf1.51.0-20261015"
assert.equal(
  digest(destination).treeSha256,
  previous.treeSha256,
  "Existing installed directory changed; preserve it",
)
assert.deepEqual(
  JSON.parse(readFileSync(resolve(destination, "manifest.json"), "utf8")),
  JSON.parse(readFileSync(resolve(built, "manifest.json"), "utf8")),
)
assert.ok(current.files.length > 0)
const normalized = (text) => text.replace(/-[A-Za-z0-9_-]{8}\.(js|css)/g, "-HASH.$1")
function jsGroups(directory, files) {
  return files
    .filter((file) => file.path.endsWith(".js"))
    .map((file) => ({
      file: file.path,
      hash: sha(normalized(readFileSync(resolve(directory, file.path), "utf8"))),
    }))
}
const oldJs = jsGroups(destination, previous.files)
const newJs = jsGroups(built, current.files)
const oldHashes = new Set(oldJs.map((file) => file.hash))
const newHashes = new Set(newJs.map((file) => file.hash))
const backup = `${destination}-switch-fix-407fbe95-${randomUUID().slice(0, 8)}`
const staged = `${destination}-selection-settings-staged-${randomUUID().slice(0, 8)}`
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
const report = {
  status: "UPDATED_SAME_DIRECTORY_AWAITING_USER_RELOAD",
  sourceHead: "e1d90dc928ca5fbbbba112e480131e1c909c93ce",
  sourceWorkingTreeDirty: true,
  frozenTreeSha256: frozen.treeSha256,
  previousLayoutTreeSha256: layout.treeSha256,
  previousSwitchTreeSha256: previous.treeSha256,
  currentTreeSha256: current.treeSha256,
  files: current.files,
  manifestUnchanged: true,
  destination,
  backup,
  buildDirectory: built,
  browserProfileOrSettingsModified: false,
  normalizedJsComparison: {
    normalization: "Vite 8-character filenames only",
    oldCount: oldJs.length,
    newCount: newJs.length,
    oldChanged: oldJs.filter((file) => !newHashes.has(file.hash)),
    newChanged: newJs.filter((file) => !oldHashes.has(file.hash)),
    expected:
      "Only unadmitted note-suggestion settings leaf removed; prior Switch and editor layout fixes retained",
  },
}
writeFileSync(
  resolve(
    "openspec/changes/upstream-sync-v1-51-0/evidence/selection-toolbar-settings-fix/artifact.json",
  ),
  `${JSON.stringify(report, null, 2)}\n`,
)
console.log(
  JSON.stringify({
    status: report.status,
    treeSha256: current.treeSha256,
    files: current.files.length,
    backup,
    normalizedJsDifferences: report.normalizedJsComparison.newChanged.map((file) => file.file),
  }),
)
