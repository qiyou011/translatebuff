// @vitest-environment node

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// Reviewed candidate against read-frog 55bcef1e (1.51.0). This is deliberately a drift alarm,
// not a behavior test: upstream fixes no longer automatically reach our fork hook.
// When it fails, review the upstream diff, port relevant fixes and run the fork
// behavior/browser tests BEFORE updating a hash. Never auto-refresh this table.
// Candidate review: the input hook ports innerText, connected/deep focus and new analytics;
// the language combobox now supports generic rows; this fork imports the shared typed
// language items and shared trigger/item, so its menu inherits motion/color changes.
const reviewedFiles = {
  "src/entrypoints/selection.content/input-translation/use-input-translation.ts":
    "ad42ac73f9efe722392131c025d0523b9d53a86b1e82b564d695d109300c522e",
  "src/entrypoints/selection.content/input-translation/index.ts":
    "369b38c3e66d29fa50b6699329582652be9c6100f57ea90e6012903f2820fd97",
  "src/components/language-combobox.tsx":
    "eb87bd7daf96257eaac156c37cd29ad36a69e62ddac2c33ed260d9a3de757002",
  "src/components/ui/base-ui/combobox.tsx":
    "5a97c532037b2a910953f69f0350568a2c7b76c2fc83f5d0aac6a5e9215df238",
}

describe("input translation upstream drift alarm", () => {
  it.each(Object.entries(reviewedFiles))("requires a fork review when %s changes", (file, hash) => {
    const content = readFileSync(resolve(process.cwd(), file), "utf8").replace(/\r\n/g, "\n")
    expect(
      createHash("sha256").update(content).digest("hex"),
      `Upstream changed: ${file}. Review and port relevant changes into src/fork/ui/selection-content/input-translation before updating this baseline.`,
    ).toBe(hash)
  })
})
