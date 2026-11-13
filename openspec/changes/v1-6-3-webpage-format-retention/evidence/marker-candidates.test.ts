import { readFileSync, writeFileSync } from "node:fs"
import { TextEncoder as NativeTextEncoder } from "node:util"
import { expect, it } from "vitest"
import { createPageTranslationQueues } from "@/fork/page-translation/queues"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

it.skipIf(process.env.RUN_FORMAT_PROVIDER_PROBE !== "true")(
  "compare whole-paragraph Microsoft marker candidates",
  async () => {
    const original = globalThis.TextEncoder
    globalThis.TextEncoder = NativeTextEncoder
    const queue = createPageTranslationQueues({
      requestQueueConfig: { rate: 100, capacity: 100 },
      batchQueueConfig: { maxItemsPerBatch: 10, maxCharactersPerBatch: 4000 },
      isScopeCancelled: () => false,
      maxConcurrent: 2,
    })
    const previous = JSON.parse(
      readFileSync(new URL("./protocol-probe-results.json", import.meta.url), "utf8"),
    )
    const samples = previous.output[0].samples.filter((s: { id: string }) =>
      ["F01", "F24", "LIVE-1", "REORDER", "REPEAT", "NESTED", "BREAKS"].includes(s.id),
    ) as { id: string; text: string }[]
    const candidates = {
      padded: (close: string, id: string) => (close ? ` ⟦/${id}⟧` : `⟦${id}⟧ `),
      numeric: (close: string, id: string) => ` ⟦${close}${id.slice(1)}⟧ `,
      curly: (close: string, id: string) => ` {{${close}${id}}} `,
      square: (close: string, id: string) => ` [[${close}${id}]] `,
      xml: (close: string, id: string) => `<${close}rf${id.toLowerCase()}>`,
      sentinel: (close: string, id: string) => ` ZXQ${close ? "END" : "START"}${id}QXZ `,
      angle: (close: string, id: string) => ` ⟪${close}${id}⟫ `,
      bracket: (close: string, id: string) => ` 【${close}${id}】 `,
    }
    const groups: unknown[] = []
    try {
      for (const targetCode of ["cmn", "jpn", "deu"] as const) {
        for (const [candidate, encode] of Object.entries(candidates)) {
          const records = await Promise.all(
            samples.map(async (sample) => {
              const expected: string[] = []
              const wire = sample.text.replace(/⟦(\/?)([BH]\d+)⟧/g, (_, slash, id) => {
                const token = encode(slash, id)
                expected.push(token.trim())
                return token
              })
              let result: string | undefined, error: string | undefined
              try {
                result = await queue.batchQueue.enqueue({
                  text: wire,
                  hash: `candidate-${candidate}-${targetCode}-${sample.id}`,
                  scope: "format-candidates",
                  scheduleAt: Date.now(),
                  provider: {
                    id: "microsoft-translate",
                    name: "microsoft-translate",
                    enabled: true,
                    provider: "microsoft-translate",
                  },
                  langConfig: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode },
                  promptConfig: structuredClone(DEFAULT_CONFIG.pageTranslation.customPromptsConfig),
                  textFormat: "plain",
                  preserveLineBreaks: true,
                })
              } catch (e) {
                error = String(e)
              }
              const missingOrRepeated = expected.filter(
                (token) => (result?.split(token).length ?? 1) !== 2,
              )
              const atoms = wire.match(/ZXQATOM\d+QXZ/g) ?? []
              const brokenAtoms = atoms.filter((token) => (result?.split(token).length ?? 1) !== 2)
              return { id: sample.id, wire, result, error, missingOrRepeated, brokenAtoms }
            }),
          )
          groups.push({ targetCode, candidate, records })
          writeFileSync(
            new URL("./marker-candidates-results.json", import.meta.url),
            JSON.stringify({ at: new Date().toISOString(), groups }, null, 2),
          )
        }
      }
    } finally {
      globalThis.TextEncoder = original
    }
    expect(groups).toHaveLength(24)
  },
  180000,
)
