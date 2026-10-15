import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const output = dirname(fileURLToPath(import.meta.url))
const record = JSON.parse(readFileSync(join(output, "rollback-build-preflight.json"), "utf8"))
const expected =
  "sha512-xaaw6G4HDB2/RczsWLD/2bnib4ykmQlTlBUN3GOEOiyErilZukQWVJG95h9zwAy0i8KY+QzDa+COPfqhI72Acw=="
const url = "https://registry.npmjs.org/@fontsource-variable/onest/-/onest-5.3.1.tgz"
const response = await fetch(url)
assert.equal(response.ok, true)
const body = Buffer.from(await response.arrayBuffer())
assert.equal(`sha512-${createHash("sha512").update(body).digest("base64")}`, expected)
const archive = join(record.temporaryRoot, "onest-5.3.1.tgz")
writeFileSync(archive, body)
const destination = join(record.sourceRoot, "node_modules/@fontsource-variable/onest")
mkdirSync(destination, { recursive: true })
const extracted = spawnSync("tar", ["-xzf", archive, "--strip-components=1", "-C", destination], {
  encoding: "utf8",
})
assert.equal(extracted.status, 0, extracted.stderr)
assert.equal(JSON.parse(readFileSync(join(destination, "package.json"))).version, "5.3.1")
record.supplement = {
  name: "@fontsource-variable/onest",
  version: "5.3.1",
  url,
  integrity: expected,
  integrityVerified: true,
  destination,
  reason:
    "Declared in old package.json/pnpm-lock but absent from main installed tree; only private clone supplemented",
}
record.firstBuild = record.build
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
const command = [join(record.sourceRoot, "node_modules/wxt/bin/wxt.mjs"), "build"]
const built = spawnSync(process.execPath, command, {
  cwd: record.sourceRoot,
  env,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
})
writeFileSync(join(output, "rollback-build-resumed.txt"), built.stdout + built.stderr)
record.build = { command: [process.execPath, ...command], exitCode: built.status }
record.status = built.status === 0 ? "BUILT" : "BUILD_FAILED"
if (built.status === 0)
  record.manifest = JSON.parse(readFileSync(join(record.artifactPath, "manifest.json"), "utf8"))
record.buildEnvPolicy =
  "No source .env copied; no inherited WXT/API key variables; localhost endpoints; private APFS-cloned old node_modules plus one integrity-verified exact old-lock font package"
writeFileSync(join(output, "rollback-build-preflight.json"), `${JSON.stringify(record, null, 2)}\n`)
process.stdout.write(
  `${JSON.stringify({ status: record.status, artifactPath: record.artifactPath, manifestVersion: record.manifest?.version, versionName: record.manifest?.version_name })}\n`,
)
if (built.status !== 0) process.exitCode = 1
