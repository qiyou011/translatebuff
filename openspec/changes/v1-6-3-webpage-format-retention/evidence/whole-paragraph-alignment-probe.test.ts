import { readFileSync, writeFileSync } from "node:fs"
import { TextEncoder as NativeTextEncoder } from "node:util"
import { expect, it } from "vitest"
import { createPageTranslationQueues } from "@/fork/page-translation/queues"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

it.skipIf(process.env.RUN_FORMAT_PROVIDER_PROBE !== "true")(
  "bound whole-paragraph single-range alignment probes",
  async () => {
    const originalEncoder = globalThis.TextEncoder
    globalThis.TextEncoder = NativeTextEncoder
    const queue = createPageTranslationQueues({
      requestQueueConfig: { rate: 5, capacity: 5 },
      batchQueueConfig: { maxItemsPerBatch: 10, maxCharactersPerBatch: 4000 },
      isScopeCancelled: () => false,
      maxConcurrent: 1,
    })
    const previous = JSON.parse(
      readFileSync(new URL("./protocol-probe-results.json", import.meta.url), "utf8"),
    )
    const samples = previous.output[0].samples.filter((s: { id: string }) =>
      ["F01", "F24", "LIVE-1", "REORDER", "REPEAT"].includes(s.id),
    ) as { id: string; text: string }[]
    samples.push({
      id: "UNSEEN-REPEAT",
      text: "Please move the ⟦B0⟧backup account⟦/B0⟧ before you delete the ⟦H1⟧backup account⟦/H1⟧ from the old device. Keep ZXQATOM2QXZ unchanged.",
    })
    const groups: unknown[] = []
    const started = Date.now()
    try {
      for (const targetCode of ["cmn", "jpn", "deu"] as const) {
        const records = await Promise.all(
          samples.map(async (sample) => {
            const keys = [...sample.text.matchAll(/⟦([BH]\d+)⟧/g)].map((match) => match[1]!)
            const baselineText = sample.text.replace(/⟦\/?[BH]\d+⟧/g, "")
            const translate = async (text: string, suffix: string) => {
              try {
                return {
                  text: await queue.batchQueue.enqueue({
                    text,
                    hash: `alignment-${targetCode}-${sample.id}-${suffix}`,
                    scope: "alignment-probe",
                    scheduleAt: Date.now(),
                    provider: {
                      id: "microsoft-translate",
                      name: "microsoft-translate",
                      enabled: true,
                      provider: "microsoft-translate",
                    },
                    langConfig: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode },
                    promptConfig: structuredClone(
                      DEFAULT_CONFIG.pageTranslation.customPromptsConfig,
                    ),
                    textFormat: "plain",
                    preserveLineBreaks: true,
                  }),
                }
              } catch (error) {
                return { error: String(error) }
              }
            }
            const baseline = await translate(baselineText, "baseline")
            const probes = await Promise.all(
              keys.map(async (key) => {
                const views = await Promise.all(
                  ["padded", "sentinel"].map(async (encoding) => {
                    const open = encoding === "padded" ? `⟦${key}⟧` : `ZXQSTART${key}QXZ`
                    const close = encoding === "padded" ? `⟦/${key}⟧` : `ZXQEND${key}QXZ`
                    const wire = sample.text.replace(/⟦(\/?)([BH]\d+)⟧/g, (_, slash, id) =>
                      id !== key ? "" : ` ${slash ? close : open} `,
                    )
                    const response = await translate(wire, `${key}-${encoding}`)
                    const value = response.text ?? ""
                    const unique =
                      value.split(open).length === 2 &&
                      value.split(close).length === 2 &&
                      value.indexOf(close) > value.indexOf(open)
                    const clean = value.replace(open, "").replace(close, "").trim()
                    const rangeText = unique
                      ? value.slice(value.indexOf(open) + open.length, value.indexOf(close))
                      : undefined
                    const atomIds = baselineText.match(/ZXQATOM\d+QXZ/g) ?? []
                    const intactAtoms = atomIds.every((token) => value.split(token).length === 2)
                    return {
                      encoding,
                      wire,
                      ...response,
                      unique,
                      intactAtoms,
                      clean,
                      rangeText,
                      matchesBaseline: unique && intactAtoms && clean === baseline.text,
                    }
                  }),
                )
                const accepted =
                  views.every((v) => v.matchesBaseline) &&
                  views[0]!.rangeText === views[1]!.rangeText
                return { key, views, accepted }
              }),
            )
            return {
              id: sample.id,
              source: baselineText,
              baseline,
              probes,
              normalCandidate: probes.every((p) => p.accepted),
            }
          }),
        )
        groups.push({ targetCode, records })
        writeFileSync(
          new URL("./whole-paragraph-alignment-results.json", import.meta.url),
          JSON.stringify(
            { at: new Date().toISOString(), elapsedMs: Date.now() - started, groups },
            null,
            2,
          ),
        )
      }
    } finally {
      globalThis.TextEncoder = originalEncoder
    }
    expect(groups).toHaveLength(3)
  },
  180000,
)
