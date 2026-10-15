import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const source = "/Users/yisen/.codex/worktrees/upstream-sync-v1-51-0/translatebuff"
const evidence = dirname(fileURLToPath(import.meta.url))
const run = join(evidence, new Date().toISOString().replace(/[:.]/g, "-"))
mkdirSync(run, { recursive: true })
const temporary = mkdtempSync(join(tmpdir(), "translatebuff-global-test-build-"))
const temporarySource = join(temporary, "source")
mkdirSync(temporarySource)
const sha = value => createHash("sha256").update(value).digest("hex")
const git = args => {
  const result = spawnSync("git", args, { cwd: source, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
function digestTree(root) {
  const files = []
  const walk = (directory, prefix = "") => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name)
      const relative = prefix ? `${prefix}/${name}` : name
      if (statSync(path).isDirectory()) walk(path, relative)
      else files.push({ path: relative, bytes: statSync(path).size, sha256: sha(readFileSync(path)) })
    }
  }
  walk(root)
  return { treeSha256: sha(JSON.stringify(files)), files }
}
const productionRoots = [".output/chrome-mv3", ".output/chrome-mv3-global"]
const productionBefore = Object.fromEntries(productionRoots.map(path => [path, digestTree(join(source, path)).treeSha256]))
const envFiles = [".env.global", ".env.global.production", ".env.production"]
const envBefore = Object.fromEntries(envFiles.map(path => [path, sha(readFileSync(join(source, path)))]))
const envText = readFileSync(join(source, ".env.global"), "utf8")
const parsedEnv = Object.fromEntries(envText.split("\n").filter(line => !/^\s*#/.test(line)).map(line => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean).map(match => [match[1], match[2].trim()]))
const publicKeys = ["WXT_WEBSITE_URL", "WXT_OFFICIAL_SITE_ORIGINS", "WXT_API_URL", "WXT_RENYIMIAO_API_URL", "WXT_RENYIMIAO_GATEWAY_URL", "WXT_RENYIMIAO_AUTH_BFF_URL", "WXT_RENYIMIAO_CLAW_API_URL"]
const publicUrls = Object.fromEntries(publicKeys.map(key => {
  assert.ok(parsedEnv[key], `Missing global test configuration: ${key}`)
  const values = parsedEnv[key].split(",").map(raw => {
    const url = new URL(raw)
    assert.equal(url.username, "", `URL userinfo forbidden: ${key}`)
    assert.equal(url.password, "", `URL userinfo forbidden: ${key}`)
    assert.equal(url.search, "", `URL query forbidden in public evidence: ${key}`)
    return url.origin + url.pathname
  })
  return [key, values]
}))
assert.equal(new URL(parsedEnv.WXT_WEBSITE_URL).host, "test.translatebuff.com")
const candidateSha = git(["rev-parse", "HEAD"])
assert.equal(candidateSha, "e1d90dc928ca5fbbbba112e480131e1c909c93ce")
const record = { candidateSha, upstreamSha: "55bcef1e684fb4e70f4dce3063e7bd3066f46891", environment: "global test", publicUrls, node: process.version, productionBefore, envBefore, temporarySource, status: "PREPARING" }
const save = () => writeFileSync(join(run, "build-result.json"), JSON.stringify(record, null, 2))
save()
const archive = join(temporary, "source.tar")
let result = spawnSync("git", ["archive", "--format=tar", `--output=${archive}`, candidateSha], { cwd: source, encoding: "utf8" })
assert.equal(result.status, 0, result.stderr)
result = spawnSync("tar", ["-xf", archive, "-C", temporarySource], { encoding: "utf8" })
assert.equal(result.status, 0, result.stderr)
cpSync(join(source, ".env.global"), join(temporarySource, ".env.global"))
for (const path of [".env.production", ".env.global.production"]) assert.equal(sha(readFileSync(join(temporarySource, path))), envBefore[path], `Exported environment mismatch: ${path}`)
console.log(JSON.stringify({ status: "CLONING_DEPENDENCIES", run, temporarySource, publicUrls }))
result = spawnSync("cp", ["-cR", join(source, "node_modules"), join(temporarySource, "node_modules")], { encoding: "utf8" })
assert.equal(result.status, 0, result.stderr)
const buildEnv = Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "SHELL"].filter(key => process.env[key]).map(key => [key, process.env[key]]))
buildEnv.PATH = `${dirname(process.execPath)}:${buildEnv.PATH}`
const secretValues = Object.entries(parsedEnv).filter(([key, value]) => /SECRET|TOKEN|API_KEY|PASSWORD|CREDENTIAL/.test(key) && value.length > 3).map(([, value]) => value)
const scrub = text => secretValues.reduce((safe, value) => safe.replaceAll(value, "[REDACTED]"), text ?? "")
console.log(JSON.stringify({ status: "BUILDING", command: "node scripts/pack.mjs test --edition global" }))
result = spawnSync(process.execPath, ["scripts/pack.mjs", "test", "--edition", "global"], { cwd: temporarySource, env: buildEnv, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
writeFileSync(join(run, "pack-test.log"), scrub(result.stdout) + scrub(result.stderr))
record.packTestExitCode = result.status
save()
assert.equal(result.status, 0, `pack test failed; see ${join(run, "pack-test.log")}`)
const guard = await import(pathToFileURL(join(temporarySource, "scripts/assert-fork-build.mjs")).href)
guard.assertEditionRequiredEnv("global", envText)
const unpacked = join(run, "unpacked")
cpSync(join(temporarySource, ".output/chrome-mv3-global"), unpacked, { recursive: true })
const artifact = digestTree(unpacked)
const manifest = JSON.parse(readFileSync(join(unpacked, "manifest.json"), "utf8"))
const bundleText = artifact.files.filter(file => /\.(js|json)$/.test(file.path)).map(file => readFileSync(join(unpacked, file.path), "utf8")).join("\n")
const requiredHosts = guard.readTestDomainsFromEnv(envText)
const presentHosts = guard.findUpstreamDomainHits(bundleText, requiredHosts)
assert.deepEqual(presentHosts, requiredHosts, "Missing expected global test backend host")
assert.deepEqual(guard.findInjectedEnvMismatches(bundleText, Object.fromEntries(publicKeys.filter(key => key !== "WXT_OFFICIAL_SITE_ORIGINS").map(key => [key, parsedEnv[key]]))), [])
assert.deepEqual(guard.findPartnerSiteHits(manifest), [])
let localeText = ""
for (const file of readdirSync(join(temporarySource, "src/locales"))) if (file.endsWith(".yml")) localeText += readFileSync(join(temporarySource, "src/locales", file), "utf8")
const editionCheck = guard.checkEditionDomains(bundleText, envText, readFileSync(join(temporarySource, ".env.production"), "utf8"), localeText)
assert.deepEqual(editionCheck.missing, [])
assert.deepEqual(editionCheck.leaked, [])
const brand = spawnSync(process.execPath, ["scripts/check-fork-brand.mjs"], { cwd: temporarySource, env: buildEnv, encoding: "utf8" })
writeFileSync(join(run, "brand-check.log"), scrub(brand.stdout) + scrub(brand.stderr))
assert.equal(brand.status, 0)
record.packageVersion = JSON.parse(readFileSync(join(temporarySource, "package.json"), "utf8")).version
record.manifest = { version: manifest.version, versionName: manifest.version_name, name: manifest.name }
record.unpacked = unpacked
record.artifactTreeSha256 = artifact.treeSha256
record.artifactFiles = artifact.files
record.standardChecks = { packTest: "PASS", requiredEditionEnv: "PASS", allTestBackendHostsPresent: "PASS", injectedEnvConsistency: "PASS", crossEditionLeak: "PASS", partnerPermissions: "PASS", brand: "PASS", productionOnlyAssertCli: "NOT_APPLICABLE_TO_TEST_ENVIRONMENT" }
record.zipFiles = []
for (const file of readdirSync(join(temporarySource, ".output"))) {
  if (!file.endsWith(".zip") || file.includes("sources")) continue
  cpSync(join(temporarySource, ".output", file), join(run, file))
  record.zipFiles.push({ path: join(run, file), sha256: sha(readFileSync(join(run, file))) })
}
record.productionAfter = Object.fromEntries(productionRoots.map(path => [path, digestTree(join(source, path)).treeSha256]))
record.envAfter = Object.fromEntries(envFiles.map(path => [path, sha(readFileSync(join(source, path)))]))
assert.deepEqual(record.productionAfter, productionBefore, "Existing production output changed")
assert.deepEqual(record.envAfter, envBefore, "Original environment changed")
record.sourceHeadUnchanged = git(["rev-parse", "HEAD"]) === candidateSha
assert.ok(record.sourceHeadUnchanged)
rmSync(temporary, { recursive: true, force: true })
record.temporarySourceRemoved = !existsSync(temporary)
record.status = "PASS"
save()
console.log(JSON.stringify({ status: record.status, candidateSha, unpacked, artifactTreeSha256: artifact.treeSha256, manifest: record.manifest, publicUrls, zipFiles: record.zipFiles, standardChecks: record.standardChecks, productionBefore, productionAfter: record.productionAfter, result: join(run, "build-result.json") }, null, 2))
