import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "../../../../..")
const sha = (input) => createHash("sha256").update(input).digest("hex")
const build = JSON.parse(readFileSync(join(here, "rollback-build-preflight.json"), "utf8"))
const files = [
  "rollback-build.mjs",
  "rollback-build-resume.mjs",
  "rollback-browser.mjs",
  "rollback-verify.mjs",
  "browser-migration.mjs",
].map((name) => join(here, name))
const changedSourceFiles = build.sourceBefore.files
  .filter((entry) => sha(readFileSync(join(build.source, entry.path))) !== entry.sha256)
  .map((entry) => entry.path)
const checks = []
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  })
  const row = {
    command: [command, ...args],
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
  checks.push(row)
  return row
}
for (const file of files) run(process.execPath, ["--check", file])
run("pnpm", ["run", "type-check", ...files])
run(process.execPath, [join(repo, "node_modules/oxfmt/bin/oxfmt"), "--check", ...files])
const report = JSON.parse(
  readFileSync(join(here, "rollback-runs/2026-10-15T05-02-08.747Z/report.json"), "utf8"),
)
assert.equal(report.status, "PASS")
assert.equal(report.stages.length, 7)
assert.equal(
  report.stages.every((row) => row.status === "PASS"),
  true,
)
const result = {
  status:
    checks.every((row) => row.exitCode === 0) && changedSourceFiles.length === 0 ? "PASS" : "FAIL",
  checkedAt: new Date().toISOString(),
  source: {
    path: build.source,
    refReadFromPlainRefFile: build.sourceRef,
    sourceBeforeTreeSha256: build.sourceBefore.treeSha256,
    sourceFilesChecked: build.sourceBefore.files.length,
    changedSourceFiles,
    allPreviouslyHashedSourceFilesUnchanged: changedSourceFiles.length === 0,
    mainNodeModulesPolicy:
      "Only read and cp -cR cloned; font supplement/build occurred in private temporary clone",
  },
  checks,
  browserReport: "rollback-runs/2026-10-15T05-02-08.747Z/report.json",
  browserResult: report.status,
  browserStagesPassed: report.stages.filter((row) => row.status === "PASS").length,
  runnerReportingNote:
    "Final runner conditionally aggregates the directDowngrade status. Prior 05-00 run's hardcoded top-level string is preserved as history; its seven per-stage results were PASS.",
}
writeFileSync(join(here, "rollback-checks.json"), `${JSON.stringify(result, null, 2)}\n`)
process.stdout.write(
  `${JSON.stringify({ status: result.status, sourceFilesChecked: result.source.sourceFilesChecked, changedSourceFiles, checks: checks.map(({ command, exitCode }) => ({ command, exitCode })) }, null, 2)}\n`,
)
if (result.status !== "PASS") process.exitCode = 1
