import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const output = dirname(fileURLToPath(import.meta.url))
const source = "/Users/yisen/Desktop/Junyun/Projects/Company/translatebuff"
const temporaryRoot = mkdtempSync(join(tmpdir(), "translatebuff-rollback-build-"))
const sourceRoot = join(temporaryRoot, "old-source")
const sha = (data) => createHash("sha256").update(data).digest("hex")
const exclude = new Set([
  ".git",
  ".output",
  ".wxt",
  "node_modules",
  ".agents",
  ".claude",
  ".codex",
  "openspec",
  "repos",
])
const allowed = (name) =>
  !exclude.has(name) && (!name.startsWith(".env") || name === ".env.example")
function sourceDigest() {
  const rows = []
  function walk(path, prefix) {
    for (const entry of readdirSync(path).sort()) {
      const next = join(path, entry)
      const relative = prefix ? `${prefix}/${entry}` : entry
      if (statSync(next).isDirectory()) walk(next, relative)
      else rows.push({ path: relative, sha256: sha(readFileSync(next)) })
    }
  }
  for (const entry of readdirSync(source).filter(allowed).sort()) {
    const path = join(source, entry)
    if (statSync(path).isDirectory()) walk(path, entry)
    else rows.push({ path: entry, sha256: sha(readFileSync(path)) })
  }
  return { treeSha256: sha(JSON.stringify(rows)), files: rows }
}
const sourceRef = readFileSync(join(source, ".git/refs/heads/feat/1.6.0"), "utf8").trim()
assert.equal(sourceRef, "4be99b341a7c940a48794232f066db43339cc2d2")
const before = sourceDigest()
const packages = Object.fromEntries(
  ["@read-frog/api-contract", "@read-frog/definitions", "zod", "wxt", "ai", "@ai-sdk/openai"].map(
    (name) => [
      name,
      JSON.parse(readFileSync(join(source, "node_modules", name, "package.json"), "utf8")).version,
    ],
  ),
)
const record = {
  source,
  sourceRef,
  temporaryRoot,
  sourceRoot,
  sourceBefore: before,
  oldDependencies: packages,
  buildEnvPolicy:
    "No source .env copied; no inherited WXT/API key variables; localhost endpoints; private APFS-cloned node_modules; no package installation",
  status: "PREPARING",
}
mkdirSync(sourceRoot, { recursive: true })
for (const entry of readdirSync(source).filter(allowed))
  cpSync(join(source, entry), join(sourceRoot, entry), { recursive: true })
const copied = spawnSync(
  "cp",
  ["-cR", join(source, "node_modules"), join(sourceRoot, "node_modules")],
  { encoding: "utf8" },
)
assert.equal(copied.status, 0, copied.stderr)
const env = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "LANG", "SHELL"]
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
)
Object.assign(env, {
  WXT_SKIP_ENV_VALIDATION: "true",
  WXT_USE_LOCAL_PACKAGES: "false",
  WXT_FORK_EDITION: "cn",
  WXT_FORK_CHANNEL: "zip",
  WXT_API_URL: "http://127.0.0.1:9",
  WXT_WEBSITE_URL: "http://127.0.0.1:9",
  WXT_OFFICIAL_SITE_ORIGINS: "http://127.0.0.1:9",
  WXT_AUTH_COOKIE_DOMAINS: "127.0.0.1",
})
record.status = "BUILDING"
writeFileSync(join(output, "rollback-build-preflight.json"), `${JSON.stringify(record, null, 2)}\n`)
const command = [join(sourceRoot, "node_modules/wxt/bin/wxt.mjs"), "build"]
const built = spawnSync(process.execPath, command, {
  cwd: sourceRoot,
  env,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
})
writeFileSync(join(output, "rollback-build.txt"), built.stdout + built.stderr)
record.build = { command: [process.execPath, ...command], exitCode: built.status }
record.status = built.status === 0 ? "BUILT" : "BUILD_FAILED"
record.sourceAfter = sourceDigest()
record.sourceUnchanged = record.sourceAfter.treeSha256 === before.treeSha256
record.artifactPath = join(sourceRoot, ".output/chrome-mv3")
if (existsSync(join(record.artifactPath, "manifest.json")))
  record.manifest = JSON.parse(readFileSync(join(record.artifactPath, "manifest.json"), "utf8"))
writeFileSync(join(output, "rollback-build-preflight.json"), `${JSON.stringify(record, null, 2)}\n`)
process.stdout.write(
  `${JSON.stringify({ status: record.status, exitCode: built.status, sourceUnchanged: record.sourceUnchanged, artifactPath: record.artifactPath, manifestVersion: record.manifest?.version, versionName: record.manifest?.version_name })}\n`,
)
if (built.status !== 0 || !record.sourceUnchanged) process.exitCode = 1
