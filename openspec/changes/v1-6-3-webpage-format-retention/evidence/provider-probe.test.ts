import { readFileSync, writeFileSync } from "node:fs"
import { TextEncoder as NativeTextEncoder } from "node:util"
import { JSDOM } from "jsdom"
import { it, expect } from "vitest"
import { createPageTranslationQueues } from "@/fork/page-translation/queues"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

// Explicitly enabled investigation only; ordinary offline test runs never send requests.
it.skipIf(process.env.RUN_FORMAT_PROVIDER_PROBE !== "true")(
  "capture real page queue format responses",
  async () => {
    const previousEncoder = globalThis.TextEncoder
    // The shared jsdom setup truncates Unicode to bytes; live transport needs real UTF-8.
    globalThis.TextEncoder = NativeTextEncoder
    const queue = createPageTranslationQueues({
      requestQueueConfig: { rate: 100, capacity: 100 },
      batchQueueConfig: { maxItemsPerBatch: 10, maxCharactersPerBatch: 4000 },
      isScopeCancelled: () => false,
      maxConcurrent: 1,
    })
    const samples = [
      "Hello world.",
      "Please ⟦B0⟧save your changes⟦/B0⟧ before closing. Keep ⟦A0⟧ unchanged.",
      "Please [B0]save your changes[/B0] before closing. Keep {{0}} unchanged.",
      "The {#0}first account{/#0} is active; the {#1}second account{/#1} expires tomorrow. Keep {{0}} unchanged.",
      "Before the [[S0]]payment deadline[[E0]], confirm the [[S1]]shipping address[[E1]]. Keep {{0}} unchanged.",
      "The ⟦B0⟧new delivery date⟦/B0⟧ is ⟦H1⟧next Thursday⟦/H1⟧. Keep ⟦A0⟧ unchanged and calculate ⟦A1⟧.",
      "The [B0]account[/B0] is active, but the [H1]account[/H1] must be verified. Run {{0}} then calculate {{1}}.",
    ]
    const records: unknown[] = []
    const prototype = readFileSync("D:/chromeDownload/网页双语格式保留-评审原型.html", "utf8")
    const data = JSON.parse(
      [...prototype.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)][0]![1]!,
    )
    const fixtures = data.cases.map((c: { id: string; source: string }) => {
      const dom = new JSDOM(c.source)
      let id = 0
      const atoms: unknown[] = []
      function serialize(node: Node): string {
        if (node.nodeType === 3) return node.textContent ?? ""
        if (node.nodeType !== 1) return ""
        const el = node as Element
        if (el.matches("code,kbd,samp,sup,sub,math")) {
          const token = `ZXQATOM${id++}QXZ`
          atoms.push({ token, html: el.outerHTML })
          return token
        }
        const tag = el.matches("b,strong,.css-bold")
          ? "B"
          : el.matches("mark,.mark,.marker,[style*='background']")
            ? "H"
            : undefined
        const key = tag ? `${tag}${id++}` : undefined
        const text = [...el.childNodes].map(serialize).join("")
        return key ? `⟦${key}⟧${text}⟦/${key}⟧` : text
      }
      const text = serialize(dom.window.document.body).replace(/\s+/g, " ").trim()
      dom.window.close()
      return { id: c.id, text, atoms }
    })
    samples.push(...fixtures.map((f: { text: string }) => f.text))
    const firstFixture = fixtures[0]!.text
    samples.push(
      firstFixture.replace("ZXQATOM2QXZ", "{{2}}"),
      firstFixture.replace(/⟦(\/?)((?:H|B)\d+)⟧/g, "{#$1$2}").replace("ZXQATOM2QXZ", "{{2}}"),
      firstFixture.replace("ZXQATOM2QXZ", "⟦A2⟧"),
    )
    const requests: unknown[] = []
    const nativeFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      )
      const metadata = { endpoint: url.origin + url.pathname, query: url.search, body: init?.body }
      try {
        const response = await nativeFetch(input, init)
        requests.push({ ...metadata, status: response.status })
        return response
      } catch (error) {
        requests.push({ ...metadata, error: String(error), cause: String((error as Error).cause) })
        throw error
      }
    }
    try {
      for (const provider of ["microsoft-translate", "google-translate"] as const) {
        const texts =
          provider === "google-translate"
            ? [
                'Please <b>save your changes</b> before closing. Keep <span translate="no">/agent/*</span> unchanged.',
                'The <b>account</b> is active, but the <mark>account</mark> must be verified. Run <span translate="no">{{0}}</span>.',
              ]
            : samples
        const result = await Promise.allSettled(
          texts.map((text, index) =>
            queue.batchQueue.enqueue({
              text,
              hash: `probe-${provider}-${index}`,
              scope: "format-feasibility",
              scheduleAt: Date.now(),
              provider: { id: provider, name: provider, enabled: true, provider },
              langConfig: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode: "cmn" },
              promptConfig: structuredClone(DEFAULT_CONFIG.pageTranslation.customPromptsConfig),
              textFormat: provider === "google-translate" ? "html" : "plain",
            }),
          ),
        )
        records.push({
          provider,
          texts,
          results: result.map((r) =>
            r.status === "fulfilled" ? r : { status: r.status, reason: String(r.reason) },
          ),
        })
        writeFileSync(
          new URL("./provider-probe-results.json", import.meta.url),
          JSON.stringify(
            {
              recordedAt: new Date().toISOString(),
              runtime: process.version,
              fixtures,
              requests,
              records,
            },
            null,
            2,
          ),
        )
      }
    } finally {
      globalThis.fetch = nativeFetch
      globalThis.TextEncoder = previousEncoder
    }
    // This assertion proves execution only, never format feasibility or semantic correctness.
    expect(records).toHaveLength(2)
  },
  180000,
)
