import { readFileSync, writeFileSync } from "node:fs"
import { TextEncoder as NativeTextEncoder } from "node:util"
import { decodeHTMLStrict } from "entities"
import { expect, it } from "vitest"
import { createPageTranslationQueues } from "@/fork/page-translation/queues"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

// Dedicated experimental transport only: the production HTML rejection is untouched.
// This probes whether a future explicit format adapter could use a minimal allowlist.
it.skipIf(process.env.RUN_FORMAT_PROVIDER_PROBE !== "true")(
  "probe minimal Microsoft markup without changing general HTML support",
  async () => {
    const encoder = globalThis.TextEncoder,
      nativeFetch = globalThis.fetch
    globalThis.TextEncoder = NativeTextEncoder
    const captured = JSON.parse(
      readFileSync(new URL("./protocol-probe-results.json", import.meta.url), "utf8"),
    )
    const samples = captured.output[0].samples.filter((s: { id: string }) =>
      ["F01", "F24", "LIVE-1", "REORDER", "REPEAT", "NESTED", "BREAKS"].includes(s.id),
    ) as { id: string; text: string }[]
    const queue = createPageTranslationQueues({
      requestQueueConfig: { rate: 100, capacity: 100 },
      batchQueueConfig: { maxItemsPerBatch: 10, maxCharactersPerBatch: 4000 },
      isScopeCancelled: () => false,
      maxConcurrent: 1,
    })
    const wireRequests: unknown[] = []
    globalThis.fetch = async (input, init) => {
      if (
        (typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
        ).startsWith("https://edge.microsoft.com/translate/translatetext") &&
        typeof init?.body === "string"
      ) {
        const body = (JSON.parse(init.body) as string[]).map(decodeHTMLStrict)
        wireRequests.push({
          url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
          body,
        })
        return nativeFetch(input, { ...init, body: JSON.stringify(body) })
      }
      return nativeFetch(input, init)
    }
    const groups: unknown[] = []
    try {
      for (const candidate of ["span-id", "span-data", "b-id", "custom-tag"] as const) {
        for (const targetCode of ["cmn", "jpn", "deu"] as const) {
          const records = await Promise.all(
            samples.map(async (sample) => {
              const wire = sample.text
                .replace(/⟦(\/?)([BH]\d+)⟧/g, (_, close, id) => {
                  const tag =
                    candidate === "custom-tag"
                      ? `rf${id.toLowerCase()}`
                      : candidate === "b-id"
                        ? "b"
                        : "span"
                  return close
                    ? `</${tag}>`
                    : candidate === "custom-tag"
                      ? `<${tag}>`
                      : `<${tag} ${candidate === "span-data" ? "data-rf-attr" : "id"}="${id}">`
                })
                .replace(/ZXQATOM\d+QXZ/g, (token) => `<span translate="no">${token}</span>`)
              try {
                const result = await queue.batchQueue.enqueue({
                  text: wire,
                  hash: `minimal-html-${candidate}-${targetCode}-${sample.id}`,
                  scope: "minimal-html-probe",
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
                return { id: sample.id, wire, result }
              } catch (e) {
                return { id: sample.id, wire, error: String(e) }
              }
            }),
          )
          groups.push({ candidate, targetCode, records })
          writeFileSync(
            new URL("./microsoft-minimal-html-results.json", import.meta.url),
            JSON.stringify(
              {
                at: new Date().toISOString(),
                note: "Experimental fetch wrapper unescapes minimal serializer payload; production queue and HTML guard unchanged.",
                wireRequests,
                groups,
              },
              null,
              2,
            ),
          )
        }
      }
    } finally {
      globalThis.TextEncoder = encoder
      globalThis.fetch = nativeFetch
    }
    expect(groups).toHaveLength(12)
  },
  180000,
)
