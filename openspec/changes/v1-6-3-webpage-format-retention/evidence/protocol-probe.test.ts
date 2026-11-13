import { readFileSync, writeFileSync } from "node:fs"
import { TextEncoder as NativeTextEncoder } from "node:util"
import { JSDOM } from "jsdom"
import { expect, it } from "vitest"
import { createPageTranslationQueues } from "@/fork/page-translation/queues"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

// Opt-in feasibility evidence, never part of ordinary offline validation.
it.skipIf(process.env.RUN_FORMAT_PROVIDER_PROBE !== "true")(
  "probe paired boundaries through real MT queues",
  async () => {
    const encoder = globalThis.TextEncoder
    globalThis.TextEncoder = NativeTextEncoder
    const queue = createPageTranslationQueues({
      requestQueueConfig: { rate: 100, capacity: 100 },
      batchQueueConfig: { maxItemsPerBatch: 10, maxCharactersPerBatch: 4000 },
      isScopeCancelled: () => false,
      maxConcurrent: 1,
    })
    const fixture = JSON.parse(
      readFileSync(new URL("./provider-probe-results.json", import.meta.url), "utf8"),
    )
    const baseline = JSON.parse(
      readFileSync(new URL("./original-site-baseline.json", import.meta.url), "utf8"),
    )
    const live = new JSDOM(baseline.lede).window.document.body
    for (const [index, el] of [...live.querySelectorAll("strong,.mark")].entries()) {
      const key = `${el.matches("strong") ? "B" : "H"}${index}`
      el.replaceWith(`⟦${key}⟧${el.textContent}⟦/${key}⟧`)
    }
    const samples = [
      ...fixture.fixtures.map((f: { id: string; text: string }) => ({ id: f.id, text: f.text })),
      { id: "LIVE-1", text: live.textContent.replace(/\s+/g, " ").trim() },
      {
        id: "REORDER",
        text: "Before you close the window, please ⟦B0⟧save your changes⟦/B0⟧ and confirm the ⟦H1⟧delivery address⟦/H1⟧.",
      },
      {
        id: "REPEAT",
        text: "The ⟦B0⟧account⟦/B0⟧ is active, but the ⟦H1⟧account⟦/H1⟧ must be verified. Run ZXQATOM2QXZ then calculate ZXQATOM3QXZ.",
      },
      {
        id: "NESTED",
        text: "Keep the ⟦B0⟧new ⟦H1⟧payment deadline⟦/H1⟧ unchanged⟦/B0⟧ and run ZXQATOM2QXZ.",
      },
      {
        id: "BREAKS",
        text: "First step: ⟦B0⟧save the file⟦/B0⟧.\n\nSecond step: run ZXQATOM1QXZ.\nLast step: close the window.",
      },
    ] as { id: string; text: string }[]
    const output: unknown[] = []
    try {
      for (const provider of ["microsoft-translate", "google-translate"] as const) {
        for (const targetCode of ["cmn", "jpn", "deu"] as const) {
          const selected = targetCode === "cmn" ? samples : samples.slice(-5)
          const requests = selected.map((sample) => ({
            ...sample,
            wire:
              provider === "microsoft-translate"
                ? sample.text
                : sample.text
                    .replace(
                      /⟦([BH])(\d+)⟧/g,
                      (_, kind, id) =>
                        `<${kind === "B" ? "b" : "mark"} data-rf-attr="${kind}${id}">`,
                    )
                    .replace(/⟦\/([BH])\d+⟧/g, (_, kind) => `</${kind === "B" ? "b" : "mark"}>`)
                    .replace(
                      /ZXQATOM\d+QXZ/g,
                      (token) => `<span translate="no" data-rf-attr="${token}">${token}</span>`,
                    ),
          }))
          const results = await Promise.allSettled(
            requests.map(({ wire }, index) =>
              queue.batchQueue.enqueue({
                text: wire,
                hash: `protocol-${provider}-${targetCode}-${index}`,
                scope: "format-protocol-probe",
                scheduleAt: Date.now(),
                provider: { id: provider, name: provider, enabled: true, provider },
                langConfig: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode },
                promptConfig: structuredClone(DEFAULT_CONFIG.pageTranslation.customPromptsConfig),
                textFormat: provider === "google-translate" ? "html" : "plain",
                preserveLineBreaks: true,
              }),
            ),
          )
          output.push({
            provider,
            targetCode,
            samples: requests.map((sample, i) => ({
              ...sample,
              result:
                results[i]!.status === "fulfilled"
                  ? results[i]
                  : {
                      status: "rejected",
                      reason: String((results[i] as PromiseRejectedResult).reason),
                    },
            })),
          })
          writeFileSync(
            new URL("./protocol-probe-results.json", import.meta.url),
            JSON.stringify({ at: new Date().toISOString(), output }, null, 2),
          )
        }
      }
    } finally {
      globalThis.TextEncoder = encoder
    }
    expect(output).toHaveLength(6)
  },
  180000,
)
