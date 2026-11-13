// @vitest-environment jsdom
import { readFileSync, writeFileSync } from "node:fs"
import { TextEncoder as NativeTextEncoder } from "node:util"
import { expect, it } from "vitest"
import { extractBilingualFormat } from "@/utils/host/translate/dom/bilingual-format"

it.skipIf(process.env.RUN_SEMANTIC_TAG_PROBE !== "true")(
  "records minimal attribute-free Microsoft tag behavior",
  async () => {
    const original = globalThis.TextEncoder
    globalThis.TextEncoder = NativeTextEncoder
    try {
      document.documentElement.innerHTML = readFileSync(
        "openspec/changes/v1-6-3-webpage-format-retention/evidence/format-fixture.html",
        "utf8",
      )
      const samples = ["F01", "F02", "F04", "F14", "F25", "F27"].map((id) => {
        const el = document.querySelector(`#${id} .sample`)!
        const source = extractBilingualFormat([el])
        const tags = ["b", "mark", "strong", "em", "i", "u", "del", "s"]
        const mapping = Object.fromEntries(
          source.manifest.formats.map((format, index) => [format.id, tags[index]]),
        )
        return {
          id,
          source: source.text,
          mapping,
          wire: source.text.replace(
            /⟦(\/?)([BHIUD]\d+)⟧/g,
            (_, close, key) => `<${close}${mapping[key]}>`,
          ),
        }
      })
      const groups = []
      for (const target of ["zh-Hans", "ja", "de"]) {
        const response = await fetch(
          `https://edge.microsoft.com/translate/translatetext?from=en&to=${target}&isEnterpriseClient=false`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              samples.map((s) => s.wire.replace(/(<\/[a-z]+>)([.,;!?])/g, "$2$1")),
            ),
            signal: AbortSignal.timeout(30000),
          },
        )
        groups.push({ target, status: response.status, results: await response.json() })
      }
      writeFileSync(
        "openspec/changes/v1-6-3-webpage-format-retention/evidence/semantic-tags-probe-results.json",
        JSON.stringify({ samples, groups }, null, 2),
      )
      expect(groups).toHaveLength(3)
    } finally {
      globalThis.TextEncoder = original
    }
  },
  120000,
)
