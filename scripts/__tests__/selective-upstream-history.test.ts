import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { validateSelectivePatches, verifySelectiveSource } from "../check-fork-boundary.mjs"

it("rebuilds shared content after removal and rejects stale sources after full merge", () => {
  const root = mkdtempSync(join(tmpdir(), "selective-history-"))
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  const content = (value: string) => writeFileSync(join(root, "shared.txt"), value)
  const commit = (subject: string) => {
    git(["add", "."])
    git(["-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "-m", subject])
    return git(["rev-parse", "HEAD"]).trim()
  }
  try {
    git(["init"])
    git(["remote", "add", "upstream", "https://github.com/mengxi-ream/read-frog.git"])
    content("base\n")
    const baseline = commit("base")
    content("base\nfirst\n")
    const first = commit("fix: first")
    content("base\nfirst\nsecond\n")
    const second = commit("fix: second")
    git(["update-ref", "refs/remotes/upstream/main", second])
    let fullSync = baseline
    const options = {
      readFile: (path: string) => readFileSync(join(root, path), "utf8"),
      verifySource: (sha: string) => verifySelectiveSource(sha, git, [fullSync]),
    }
    const ledger = (shas: string[], text: string) => ({
      sources: shas.map((sha) => ({ sha, subject: "fix: source", status: "applied" })),
      files: [
        {
          path: "shared.txt",
          sha256: createHash("sha256").update(text).digest("hex"),
          sources: shas,
        },
      ],
    })
    expect(
      validateSelectivePatches(ledger([first, second], "base\nfirst\nsecond\n"), options),
    ).toEqual(["shared.txt"])
    // Removing the first contribution rebuilds the final file, rather than restoring its old blob.
    content("base\nsecond\n")
    expect(validateSelectivePatches(ledger([second], "base\nsecond\n"), options)).toEqual([
      "shared.txt",
    ])
    fullSync = second
    expect(() => validateSelectivePatches(ledger([second], "base\nsecond\n"), options)).toThrow(
      /Stale selective source/,
    )
    expect(validateSelectivePatches({ sources: [], files: [] }, options)).toEqual([])
    expect(() => verifySelectiveSource("f".repeat(40), git, [baseline])).toThrow(/Command failed/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
