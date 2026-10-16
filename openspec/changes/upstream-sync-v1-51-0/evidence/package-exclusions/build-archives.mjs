import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseEnv } from "node:util"

const frozen = resolve(process.env.PACKAGE_BASELINE_DIR ?? ".output/chrome-mv3-global")
function jsText(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory()
        ? jsText(path)
        : entry.name.endsWith(".js")
          ? readFileSync(path, "utf8")
          : ""
    })
    .join("\n")
}
const ids = [
  ...new Set(
    [...jsText(frozen).matchAll(/WXT_GOOGLE_CLIENT_ID\s*:\s*(["'`])([^"'`]+)\1/g)].map(
      (match) => match[2],
    ),
  ),
]
assert.equal(ids.length, 1, "Frozen package must identify exactly one public Google client")
const configured = parseEnv(readFileSync(".env.global.production", "utf8"))
const buildEnvironment = {
  ...process.env,
  ...configured,
  WXT_FORK_EDITION: "global",
  WXT_FORK_CHANNEL: "global-zip",
  WXT_GOOGLE_CLIENT_ID: ids[0],
}
writeFileSync(
  ".wxt/package-exclusions-20261016.config.ts",
  'import base from "../wxt.config"\nexport default { ...base, outDir: ".output/package-exclusions-20261016" }\n',
)
const run = spawnSync(
  process.execPath,
  [
    "node_modules/wxt/bin/wxt.mjs",
    "zip",
    "--sources",
    "--config",
    ".wxt/package-exclusions-20261016.config.ts",
  ],
  {
    env: buildEnvironment,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
)
let log = `${run.stdout || ""}\n${run.stderr || ""}`
for (const [key, value] of Object.entries(buildEnvironment)) {
  if (/SECRET|TOKEN|API_KEY|PASSWORD|CREDENTIAL/.test(key) && value?.length > 3)
    log = log.replaceAll(value, "[REDACTED]")
}
writeFileSync(
  resolve("openspec/changes/upstream-sync-v1-51-0/evidence/package-exclusions/build-global.log"),
  log,
)
assert.equal(run.status, 0, "Build failed; see redacted build log")
const manifest = JSON.parse(
  readFileSync(".output/package-exclusions-20261016/chrome-mv3-global/manifest.json", "utf8"),
)
assert.equal(manifest.version, "1.6.0")
assert.ok(manifest.version_name.endsWith("1.6.0（rf 1.51.0）"))
console.log(
  JSON.stringify({
    status: "PASS",
    output: ".output/package-exclusions-20261016/chrome-mv3-global",
    manifestVersion: "1.6.0",
    upstreamVersion: "1.51.0",
    environment:
      "Same global production edition, channel and public Google client as frozen candidate",
  }),
)
