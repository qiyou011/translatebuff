import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const directory = dirname(fileURLToPath(import.meta.url))
const repository = resolve(process.env.TEST_REPO ?? join(directory, "../../../../.."))
const artifactDirectory = resolve(
  process.env.EXTENSION_PATH ?? join(repository, ".output/chrome-mv3"),
)
const baselinePath = resolve(
  process.env.MAIN_BASELINE_RESULT ??
    join(directory, "../browser-regression/runs/2026-10-15T04-51-44.917Z/result.json"),
)
const hash = (value) => createHash("sha256").update(value).digest("hex")
const files = []
function walk(current) {
  for (const name of readdirSync(current).sort()) {
    const full = join(current, name)
    if (statSync(full).isDirectory()) walk(full)
    else
      files.push({
        path: relative(artifactDirectory, full),
        bytes: statSync(full).size,
        sha256: hash(readFileSync(full)),
      })
  }
}
walk(artifactDirectory)
const legacyProjection = (rows) => rows.map(({ path, sha256 }) => ({ path, sha256 }))
const differences = (left, right, withBytes) => {
  const other = new Map(right.map((file) => [file.path, file]))
  return left
    .filter((file) => {
      const match = other.get(file.path)
      return !match || match.sha256 !== file.sha256 || (withBytes && match.bytes !== file.bytes)
    })
    .map((file) => file.path)
}
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"))
const mainTreeSha256 = hash(JSON.stringify(files))
const legacyTreeSha256 = hash(JSON.stringify(legacyProjection(files)))
const baselineDiff = [
  ...new Set([
    ...differences(files, baseline.identity.artifact.files, true),
    ...differences(baseline.identity.artifact.files, files, true),
  ]),
]
assert.deepEqual(baselineDiff, [], "Current artifact must match every baseline path, bytes and SHA")
assert.equal(mainTreeSha256, baseline.identity.artifact.treeSha256)
const runs = []
for (const runDirectory of readdirSync(join(directory, "runs")).sort()) {
  const rawPath = join(directory, "runs", runDirectory, "result.json")
  const raw = JSON.parse(readFileSync(rawPath, "utf8"))
  const rawFiles = raw.identity.artifact.files
  const rawDiff = [
    ...new Set([...differences(files, rawFiles, false), ...differences(rawFiles, files, false)]),
  ]
  assert.deepEqual(
    rawDiff,
    [],
    "All saved YouTube raw per-file hashes must match the frozen artifact",
  )
  const historicalAlgorithm =
    rawFiles[0]?.bytes === undefined ? "legacy path+sha256" : "main path+bytes+sha256"
  assert.equal(hash(JSON.stringify(rawFiles)), raw.identity.artifact.treeSha256)
  runs.push({
    rawPath: relative(repository, rawPath),
    rawResultSha256: hash(readFileSync(rawPath)),
    candidateSha: raw.identity.candidateSha,
    historicalAlgorithm,
    historicalTreeSha256: raw.identity.artifact.treeSha256,
    originalArtifactUnchanged: raw.identity.artifactUnchanged,
    perFileCount: rawFiles.length,
    pathsAndContentHashesEqual: true,
    differences: rawDiff,
    sameArtifactNormalizedMainTreeSha256: mainTreeSha256,
  })
}
const result = {
  recordedAt: new Date().toISOString(),
  artifactDirectory,
  sourceBaselinePath: relative(repository, baselinePath),
  sourceBaselineSha256: hash(readFileSync(baselinePath)),
  candidateSha: baseline.identity.candidateSha,
  explanation:
    "The original YouTube tree hash omitted bytes from each serialized file row. Both algorithms use identical relative paths, depth-first sorted filenames and content SHA-256. The differing tree hash reflects row serialization only. Every current artifact path, byte length and content SHA equals the saved main-run baseline; every saved YouTube path and content SHA equals the same artifact. Raw historical results were read only.",
  mainAlgorithm:
    "SHA256(UTF8(JSON.stringify(files))) with files from recursively sorted readdir, ordered row keys {path: relative(directory,file), bytes: stat.size, sha256: SHA256(fileBytes)}; no JSON whitespace or trailing newline",
  legacyAlgorithm:
    "SHA256(UTF8(JSON.stringify(files))) using same ordering and {path,sha256} rows, without bytes",
  mainTreeSha256,
  legacyTreeSha256,
  fileCount: files.length,
  currentVsMainBaselineDifferences: baselineDiff,
  runs,
}
const outputPath = join(
  directory,
  `artifact-reconciliation-${new Date().toISOString().replaceAll(":", "-")}.json`,
)
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" })
console.log(
  JSON.stringify(
    {
      outputPath,
      mainTreeSha256,
      legacyTreeSha256,
      fileCount: files.length,
      comparedRuns: runs.length,
      differences: baselineDiff,
    },
    null,
    2,
  ),
)
