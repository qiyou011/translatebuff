// @vitest-environment node

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

// Reviewed against read-frog 02ad422c (1.46.6). This is deliberately a drift alarm,
// not a behavior test: upstream fixes no longer automatically reach our fork hook.
// When it fails, review the upstream diff, port relevant fixes and run the fork
// behavior/browser tests BEFORE updating a hash. Never auto-refresh this table.
const reviewedFiles = {
  "src/entrypoints/selection.content/input-translation/use-input-translation.ts":
    "509d37229d17695d69eafe9ca3fa5399f1dc8d77d2dfa25689eb4f89b18a7a3c",
  "src/entrypoints/selection.content/input-translation/index.ts":
    "369b38c3e66d29fa50b6699329582652be9c6100f57ea90e6012903f2820fd97",
  "src/components/language-combobox.tsx":
    "05b18d5cd7d2baa6846aef1a0c4684f9ffec8e8ee8bb789c373f410f5473d5fc",
  "src/components/ui/base-ui/combobox.tsx":
    "cce4277221d40e4ab6a9e5c1b1f78c5f24cdbd97f461ae87d6edf247cdc6a82f",
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
