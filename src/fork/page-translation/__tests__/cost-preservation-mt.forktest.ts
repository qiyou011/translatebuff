import type { PageTranslationData } from "../types"
import type { Config } from "@/types/config/config"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { setupPageTranslationHandlers } from "@/entrypoints/background/page-translation"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { createPageTranslationQueues } from "../queues"

type MtProvider = "google-translate" | "microsoft-translate"
interface TransportCall {
  provider: MtProvider
  texts: string[]
  from: string
  to: string
  bodyBytes: number
  startedAt: number
  signal?: AbortSignal
}
const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (message: any) => Promise<any>>(),
  cache: new Map<string, { key: string; translation: string }>(),
  get: vi.fn<(...args: any[]) => any>(),
  put: vi.fn<(...args: any[]) => any>(),
  init: vi.fn<(...args: any[]) => any>(),
  execute: vi.fn<(...args: any[]) => any>(),
  generate: vi.fn<(...args: any[]) => any>(),
}))
vi.mock("@/utils/message", () => ({
  onMessage: (name: string, handler: any) => mocks.handlers.set(name, handler),
}))
vi.mock("@/entrypoints/background/config", () => ({ ensureInitializedConfig: mocks.init }))
vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    translationCache: { get: mocks.get, put: mocks.put, delete: async () => {} },
    articleSummaryCache: { get: async () => undefined, put: async () => {} },
  },
}))
vi.mock("@/utils/batch-request-record", () => ({ putBatchRequestRecord: async () => {} }))
vi.mock("@/utils/host/translate/execute-translate", () => ({ executeTranslate: mocks.execute }))
vi.mock("ai", () => ({ generateText: mocks.generate }))
vi.mock("@/utils/providers/model", () => ({ getLanguageModelForConfig: () => "unused-model" }))

let config: Config
let calls: TransportCall[]
function metric(name: string, details: Record<string, unknown>) {
  process.stdout.write(`MT_PRESERVATION_METRIC ${JSON.stringify({ name, ...details })}\n`)
}
function item(
  text: string,
  provider: MtProvider = "microsoft-translate",
  scope = "1:page",
): PageTranslationData {
  return {
    text,
    scope,
    hash: text,
    scheduleAt: Date.now(),
    langConfig: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode: "cmn" },
    promptConfig: structuredClone(DEFAULT_CONFIG.pageTranslation.customPromptsConfig),
    provider: { id: provider, name: provider, provider, enabled: true },
  }
}
function queue() {
  return createPageTranslationQueues({
    requestQueueConfig: config.pageTranslation.requestQueueConfig,
    batchQueueConfig: config.pageTranslation.batchQueueConfig,
    isScopeCancelled: () => false,
  })
}
function packet(text: string, provider: MtProvider, tabId = 1, feature = "pageTranslation") {
  const data = item(text, provider)
  return {
    sender: { tab: { id: tabId } },
    data: {
      text,
      hash: text,
      sessionId: "page",
      scheduleAt: Date.now(),
      langConfig: data.langConfig,
      providerRef: { kind: "local", config: data.provider },
      hostedFeature: feature,
    },
  }
}
function reply(call: TransportCall, values = call.texts.map(() => "translated")) {
  return {
    ok: true,
    json: async () =>
      call.provider === "google-translate"
        ? [values]
        : values.map((text) => ({ translations: [{ text }] })),
  } as Response
}
function transport(responder: (call: TransportCall) => Response | Promise<Response> = reply) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string, init: RequestInit) => {
      const url = new URL(input)
      if (typeof init.body !== "string") throw new Error("Expected a JSON string request body")
      const body = init.body
      const parsed = JSON.parse(body)
      const google = url.hostname === "translate-pa.googleapis.com"
      const call: TransportCall = {
        provider: google ? "google-translate" : "microsoft-translate",
        texts: google ? parsed[0][0] : parsed,
        from: google ? parsed[0][1] : url.searchParams.get("from")!,
        to: google ? parsed[0][2] : url.searchParams.get("to")!,
        bodyBytes: new TextEncoder().encode(body).length,
        startedAt: Date.now(),
        signal: init.signal ?? undefined,
      }
      calls.push(call)
      return Promise.resolve(responder(call))
    }),
  )
}
beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  vi.clearAllMocks()
  calls = []
  mocks.handlers.clear()
  mocks.cache.clear()
  mocks.get.mockImplementation((key: string) => mocks.cache.get(key))
  mocks.put.mockImplementation((entry: { key: string; translation: string }) => {
    mocks.cache.set(entry.key, entry)
  })
  mocks.execute.mockResolvedValue("input translated")
  mocks.generate.mockRejectedValue(new Error("This MT suite must never invoke an LLM"))
  config = structuredClone(DEFAULT_CONFIG)
  config.pageTranslation.requestQueueConfig = { rate: 100000, capacity: 100 }
  config.pageTranslation.batchQueueConfig = { maxItemsPerBatch: 1, maxCharactersPerBatch: 4000 }
  mocks.init.mockResolvedValue(config)
  await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, config)
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected unmocked fetch")))
})
afterEach(() => {
  if (mocks.generate.mock.calls.length > 0) throw new Error("MT validation invoked an LLM")
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("MT cost preservation through real queues and transports", () => {
  it.each(["google-translate", "microsoft-translate"] as const)(
    "%s splits 101 items into exactly 100 plus 1",
    async (provider) => {
      transport()
      const queues = queue()
      const pending = Promise.all(
        Array.from({ length: 101 }, (_, index) =>
          queues.batchQueue.enqueue(item(`paragraph-${index}`, provider)),
        ),
      )
      await vi.advanceTimersByTimeAsync(100)
      expect(await pending).toHaveLength(101)
      expect(calls.map((call) => call.texts.length)).toEqual([100, 1])
      expect(calls.every((call) => call.bodyBytes < 32768)).toBe(true)
      metric("item-limit", {
        provider,
        inputItems: 101,
        transportCalls: calls.length,
        batchSizes: calls.map((call) => call.texts.length),
        bodyBytes: calls.map((call) => call.bodyBytes),
      })
    },
  )

  it.each(["google-translate", "microsoft-translate"] as const)(
    "%s splits escaped payloads below the encoded 32KiB cap",
    async (provider) => {
      transport()
      const queues = queue()
      const pending = Promise.all(
        ["a", "b"].map((suffix) =>
          queues.batchQueue.enqueue(item(`${"&".repeat(4000)}${suffix}`, provider)),
        ),
      )
      await vi.advanceTimersByTimeAsync(100)
      expect(await pending).toEqual(["translated", "translated"])
      expect(calls.map((call) => call.texts.length)).toEqual([1, 1])
      expect(calls.every((call) => call.bodyBytes < 32768)).toBe(true)
      metric("encoded-payload", {
        provider,
        sourceCharacters: 8002,
        transportCalls: calls.length,
        batchSizes: calls.map((call) => call.texts.length),
        bodyBytes: calls.map((call) => call.bodyBytes),
      })
    },
  )

  it("separates provider snapshots, languages, context, HTML and semantic newline groups", async () => {
    transport()
    const queues = queue()
    const base = item("base-one")
    const first = queues.batchQueue.enqueue(base)
    base.provider.name = "mutated after enqueue"
    const variants: PageTranslationData[] = [
      item("base-two"),
      { ...item("target-japanese"), langConfig: { ...base.langConfig, targetCode: "jpn" } },
      { ...item("source-german"), langConfig: { ...base.langConfig, sourceCode: "deu" } },
      { ...item("other-provider-id"), provider: { ...item("").provider, id: "other-ms" } },
      {
        ...item("other-provider-config"),
        provider: { ...item("").provider, name: "edited snapshot" },
      },
      { ...item("other-context"), context: { webTitle: "different captured title" } },
      { ...item("ms-semantic-lines"), preserveLineBreaks: true },
      item("google-one", "google-translate"),
      item("google-two", "google-translate"),
      { ...item("<b>google-html</b>", "google-translate"), textFormat: "html" },
      { ...item("google-semantic-lines", "google-translate"), preserveLineBreaks: true },
      {
        ...item("google-other-context", "google-translate"),
        context: { webTitle: "different captured title" },
      },
    ]
    const pending = Promise.all([first, ...variants.map((data) => queues.batchQueue.enqueue(data))])
    await vi.advanceTimersByTimeAsync(100)
    expect(await pending).toHaveLength(13)
    expect(calls).toHaveLength(11)
    expect(calls.filter((call) => call.texts.length === 2).map((call) => call.texts)).toEqual([
      ["base-one", "base-two"],
      ["google-one", "google-two"],
    ])
    expect(calls.find((call) => call.texts.includes("target-japanese"))).toMatchObject({
      from: "en",
      to: "ja",
    })
    expect(calls.find((call) => call.texts.includes("source-german"))).toMatchObject({
      from: "de",
      to: "zh",
    })
    const rejected = queues.batchQueue.enqueue({
      ...item("<b>forbidden MS HTML</b>"),
      textFormat: "html",
    })
    await expect(rejected).rejects.toThrow("HTML")
    expect(calls).toHaveLength(11)
    metric("semantic-groups", {
      inputItems: 13,
      transportCalls: calls.length,
      batchSizes: calls.map((call) => call.texts.length),
      frozenInputSnapshotRetained: true,
      microsoftHtmlCalls: 0,
    })
  })

  it("holds actual MT calls at four with 5ms latency while background input completes independently", async () => {
    let active = 0
    let maxActive = 0
    transport(async (call) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((done) => setTimeout(done, 5))
      active--
      return reply(call)
    })
    setupPageTranslationHandlers(createPageTranslationQueues)
    const translate = mocks.handlers.get("enqueueTranslateRequest")!
    const pending = Promise.all(
      Array.from({ length: 5 }, (_, index) => {
        const message = packet(`page-${index}`, "microsoft-translate")
        return translate({
          ...message,
          data: { ...message.data, webTitle: `separate group ${index}` },
        })
      }),
    )
    await vi.advanceTimersByTimeAsync(100)
    expect(calls).toHaveLength(4)
    expect(active).toBe(4)
    const inputStartedAt = Date.now()
    const input = translate(packet("input", "microsoft-translate", 1, "inputTranslation"))
    await vi.advanceTimersByTimeAsync(0)
    expect(await input).toBe("input translated")
    expect(Date.now() - inputStartedAt).toBe(0)
    expect(active).toBe(4)
    await vi.advanceTimersByTimeAsync(10)
    expect(await pending).toEqual(Array.from({ length: 5 }, () => "translated"))
    expect(maxActive).toBe(4)
    expect(calls.map((call) => call.startedAt)).toEqual([100, 100, 100, 100, 105])
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    metric("four-slots-input-isolation", {
      pageRequests: calls.length,
      simulatedLatencyMs: 5,
      maxPageInFlight: maxActive,
      pageStartedAtMs: calls.map((call) => call.startedAt),
      inputWaitBehindPageMs: 0,
      inputExecuteMockCalls: mocks.execute.mock.calls.length,
    })
  })

  it.each(["google-translate", "microsoft-translate"] as const)(
    "%s cancels one scope without retry, late cache write or killing its sibling",
    async (provider) => {
      const finish: ((value: Response) => void)[] = []
      transport(() => new Promise((resolve) => finish.push(resolve)))
      setupPageTranslationHandlers(createPageTranslationQueues)
      const translate = mocks.handlers.get("enqueueTranslateRequest")!
      const cancelled = translate(packet("same-cache-key", provider, 1)).catch(
        (error) => error.name,
      )
      const sibling = translate(packet("same-cache-key", provider, 2))
      await vi.advanceTimersByTimeAsync(100)
      expect(calls).toHaveLength(2)
      await mocks.handlers.get("cancelPageTranslationRequests")!({
        sender: { tab: { id: 1 } },
        data: { sessionId: "page" },
      })
      expect(calls[0]!.signal?.aborted).toBe(true)
      expect(calls[1]!.signal?.aborted).toBe(false)
      finish[0]!(reply(calls[0]!, []))
      finish[1]!(reply(calls[1]!, ["healthy sibling"]))
      await vi.advanceTimersByTimeAsync(20000)
      expect(await cancelled).toBe("TranslationCancelledError")
      expect(await sibling).toBe("healthy sibling")
      expect(calls).toHaveLength(2)
      expect(mocks.put).toHaveBeenCalledTimes(1)
      expect(mocks.cache.get("same-cache-key")?.translation).toBe("healthy sibling")
      expect(await translate(packet("same-cache-key", provider, 3))).toBe("healthy sibling")
      expect(calls).toHaveLength(2)
      metric("scope-cancel-cache", {
        provider,
        originalCalls: 2,
        callsAfterLateMalformedResult: calls.length,
        cancelledRejected: true,
        cacheWrites: mocks.put.mock.calls.length,
        crossTabCacheHitAdditionalCalls: 0,
      })
    },
  )

  it.each(["google-translate", "microsoft-translate"] as const)(
    "%s does not retry a cancelled transport's late network failure",
    async (provider) => {
      let rejectTransport!: (reason: Error) => void
      transport(
        () =>
          new Promise((_done, reject) => {
            rejectTransport = reject
          }),
      )
      setupPageTranslationHandlers(createPageTranslationQueues)
      const pending = mocks.handlers.get("enqueueTranslateRequest")!(
        packet("cancel-late-error", provider),
      ).catch((error) => error.name)
      await vi.advanceTimersByTimeAsync(100)
      await mocks.handlers.get("cancelPageTranslationRequests")!({
        sender: { tab: { id: 1 } },
        data: { sessionId: "page" },
      })
      rejectTransport(new Error("late network error"))
      await vi.advanceTimersByTimeAsync(20000)
      expect(await pending).toBe("TranslationCancelledError")
      expect(calls).toHaveLength(1)
      expect(mocks.put).not.toHaveBeenCalled()
      metric("cancel-no-network-retry", {
        provider,
        transportCalls: calls.length,
        cacheWrites: 0,
        waitedAfterCancellationMs: 20000,
      })
    },
  )

  it.each(["google-translate", "microsoft-translate"] as const)(
    "%s retries only one missing position, preserving healthy siblings",
    async (provider) => {
      transport((call) =>
        reply(call, call.texts.length === 3 ? ["first", "", "third"] : ["second"]),
      )
      const queues = queue()
      const pending = Promise.all(
        ["one", "two", "three"].map((text) => queues.batchQueue.enqueue(item(text, provider))),
      )
      await vi.advanceTimersByTimeAsync(100)
      expect(await pending).toEqual(["first", "second", "third"])
      expect(calls.map((call) => call.texts.length)).toEqual([3, 1])
      expect(calls[1]!.texts).toEqual(["two"])
      metric("partial-fallback", {
        provider,
        inputItems: 3,
        transportCalls: calls.length,
        batchSizes: calls.map((call) => call.texts.length),
        healthyItemsReissued: 0,
      })
    },
  )

  it.each(["google-translate", "microsoft-translate"] as const)(
    "%s writes decoded MT output once and shares persistent-cache contract across tabs",
    async (provider) => {
      transport((call) => reply(call, ["&amp;amp;"]))
      setupPageTranslationHandlers(createPageTranslationQueues)
      const translate = mocks.handlers.get("enqueueTranslateRequest")!
      const first = translate(packet("decode-once", provider))
      await vi.advanceTimersByTimeAsync(100)
      expect(await first).toBe("&amp;")
      expect(await translate(packet("decode-once", provider, 2))).toBe("&amp;")
      expect(calls).toHaveLength(1)
      expect(mocks.put).toHaveBeenCalledTimes(1)
      expect(mocks.cache.get("decode-once")?.translation).toBe("&amp;")
      metric("cache-decode-once", {
        provider,
        callerHashPreserved: mocks.cache.has("decode-once"),
        transportCalls: calls.length,
        cacheWrites: mocks.put.mock.calls.length,
        normalizedOutput: "&amp;",
        realIndexedDb: false,
      })
    },
  )
})
