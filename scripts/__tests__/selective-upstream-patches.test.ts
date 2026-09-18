import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import * as boundary from "../check-fork-boundary.mjs"

const first = "a".repeat(40)
const second = "b".repeat(40)
const digest = createHash("sha256").update("content\n").digest("hex")
const fixture = () => ({
  sources: [first, second].map((sha) => ({ sha, subject: "fix: example", status: "applied" })),
  files: [{ path: "src/example.ts", sha256: digest, sources: [first, second] }],
})
const options = {
  readFile: () => "content\r\n",
  verifySource: () => {},
}

describe("selective upstream ledger", () => {
  it("allows the final cumulative file with multiple verified contributors and LF normalization", () => {
    expect(boundary.validateSelectivePatches(fixture(), options)).toEqual(["src/example.ts"])
  })

  it.each([
    [
      "fingerprint drift",
      (ledger: ReturnType<typeof fixture>) => {
        ledger.files[0]!.sha256 = "0".repeat(64)
      },
    ],
    [
      "duplicate path",
      (ledger: ReturnType<typeof fixture>) => {
        ledger.files.push(ledger.files[0]!)
      },
    ],
    [
      "unknown source",
      (ledger: ReturnType<typeof fixture>) => {
        ledger.files[0]!.sources = ["c".repeat(40)]
      },
    ],
    [
      "path traversal",
      (ledger: ReturnType<typeof fixture>) => {
        ledger.files[0]!.path = "../outside"
      },
    ],
    [
      "duplicate source",
      (ledger: ReturnType<typeof fixture>) => {
        ledger.sources.push(ledger.sources[0]!)
      },
    ],
  ])("rejects %s", (_name, mutate) => {
    const ledger = fixture()
    mutate(ledger)
    expect(() => boundary.validateSelectivePatches(ledger, options)).toThrow(
      /Selective patches|Nonofficial source|Stale selective source|git failure/,
    )
  })

  it("checks an untouched stale source before allowing any file", () => {
    expect(() =>
      boundary.validateSelectivePatches(fixture(), {
        ...options,
        verifySource: (sha: string) => {
          if (sha === second) throw new Error("stale source")
        },
      }),
    ).toThrow("stale source")
  })

  it("accepts a tombstone only while the removed file is absent", () => {
    const ledger = fixture()
    const deleted = {
      ...ledger,
      files: [{ path: "src/deleted.ts", deleted: true, sources: [first, second] }],
    }
    expect(
      boundary.validateSelectivePatches(deleted, { ...options, readFile: () => null }),
    ).toEqual(["src/deleted.ts"])
    expect(() => boundary.validateSelectivePatches(deleted, options)).toThrow(
      /Selective patches|Nonofficial source|Stale selective source|git failure/,
    )
  })
})

describe("official source verification", () => {
  const git =
    (overrides: Record<string, string | number> = {}) =>
    (args: string[]) => {
      const key = args.join(" ")
      const responses: Record<string, string | number> = {
        "remote get-url upstream": "https://github.com/mengxi-ream/read-frog.git\n",
        [`cat-file -e ${first}^{commit}`]: "",
        [`merge-base --is-ancestor ${first} refs/remotes/upstream/main`]: "",
        [`merge-base --is-ancestor ${first} baseline`]: 1,
        ...overrides,
      }
      const response = responses[key]
      if (typeof response === "string") return response
      throw Object.assign(new Error(`git failure: ${key}`), { status: response ?? 128 })
    }
  it("accepts an official source not yet fully merged", () => {
    expect(() => boundary.verifySelectiveSource(first, git(), ["baseline"])).not.toThrow(
      /Selective patches|Nonofficial source|Stale selective source|git failure/,
    )
  })
  it.each([
    ["untrusted remote", "remote get-url upstream", "https://example.com/repo.git"],
    ["missing object", `cat-file -e ${first}^{commit}`, 128],
    ["nonofficial source", `merge-base --is-ancestor ${first} refs/remotes/upstream/main`, 1],
    ["git error", `merge-base --is-ancestor ${first} baseline`, 128],
    ["stale source", `merge-base --is-ancestor ${first} baseline`, ""],
  ] as const)("rejects %s", (_name, command, response) => {
    expect(() =>
      boundary.verifySelectiveSource(first, git({ [command]: response }), ["baseline"]),
    ).toThrow(/Selective patches|Nonofficial source|Stale selective source|git failure/)
  })
})
