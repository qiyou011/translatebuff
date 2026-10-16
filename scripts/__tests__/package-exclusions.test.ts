import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import config from "../../wxt.config"

// Use the same file selector that WXT uses for both ZIPs, without adding a dependency.
const requireFromWxt = createRequire(createRequire(import.meta.url).resolve("wxt"))
const { glob } = requireFromWxt("tinyglobby") as {
  glob: (
    include: string[],
    options: { cwd: string; ignore: string[]; onlyFiles: boolean },
  ) => Promise<string[]>
}
const roots: string[] = []

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "translatebuff-package-test-"))
  roots.push(root)
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const target = join(root, path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, content)
    }),
  )
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("distribution archive contents", () => {
  it("omits repository documents accidentally copied to extension output but keeps runtime assets", async () => {
    const root = await fixture({
      "manifest.json": "{}",
      "background.js": "// runtime",
      "popup.html": "<html></html>",
      "assets/icon.png": "runtime image",
      "_locales/en/messages.json": "{}",
      "openspec/changes/example/proposal.md": "proposal",
      "openspec/changes/example/specs/feature/spec.md": "specification",
      "openspec/changes/example/validation.md": "validation",
      "openspec/changes/example/qa-product-handoff.md": "handoff",
      "openspec/changes/example/evidence/network.jsonl": "network record",
      "openspec/changes/example/evidence/screenshot.png": "test screenshot",
      "docs/qa-report.md": "test report",
      "readmes/handoff.md": "handoff",
      "UPSTREAM_FOLLOW_UPS.md": "verification follow-up",
    })
    const files = await glob(["**/*"], {
      cwd: root,
      ignore: config.zip?.exclude ?? [],
      onlyFiles: true,
    })
    expect(files).toHaveLength(5)
    expect(files).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "background.js",
        "popup.html",
        "assets/icon.png",
        "_locales/en/messages.json",
      ]),
    )
  })

  it("omits planning and regression evidence from source archives while keeping rebuild inputs", async () => {
    const root = await fixture({
      "package.json": "{}",
      "pnpm-lock.yaml": "lockfileVersion: '9.0'",
      "src/entrypoints/background.ts": "// source",
      "src/assets/icon.svg": "<svg></svg>",
      "SOURCE_CODE_REVIEW.md": "reviewer build instructions",
      LICENSE: "license",
      "openspec/changes/example/proposal.md": "proposal",
      "openspec/specs/feature/spec.md": "specification",
      "openspec/changes/example/validation.md": "validation",
      "openspec/changes/example/qa-product-handoff.md": "handoff",
      "openspec/changes/example/evidence/result.json": "{}",
      "openspec/changes/example/evidence/screenshot.png": "test screenshot",
      "openspec/changes/example/evidence/fixture.html": "test fixture",
      "openspec/changes/example/evidence/verify.mjs": "// verification script",
      "openspec/changes/example/evidence/local-only.log": "ignored local log",
      "docs/qa-report.md": "test report",
      "readmes/handoff.md": "handoff",
      "UPSTREAM_FOLLOW_UPS.md": "verification follow-up",
    })
    const files = await glob(config.zip?.includeSources ?? ["**/*"], {
      cwd: root,
      ignore: config.zip?.excludeSources ?? [],
      onlyFiles: true,
    })
    expect(files).toHaveLength(6)
    expect(files).toEqual(
      expect.arrayContaining([
        "package.json",
        "pnpm-lock.yaml",
        "src/entrypoints/background.ts",
        "src/assets/icon.svg",
        "SOURCE_CODE_REVIEW.md",
        "LICENSE",
      ]),
    )
  })
})
