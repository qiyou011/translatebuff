import type { PageTranslationData } from "../types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { createPageTranslationQueues } from "../queues"

const mocks = vi.hoisted(() => ({ generate: vi.fn<(...args: any[]) => any>() }))
vi.mock("ai", () => ({ generateText: mocks.generate }))
vi.mock("@/utils/providers/model", () => ({ getLanguageModelForConfig: () => "captured-model" }))
vi.mock("@/utils/batch-request-record", () => ({ putBatchRequestRecord: async () => {} }))

function item(text: string, scope = "1:page"): PageTranslationData {
  return {
    text,
    scope,
    hash: text,
    scheduleAt: Date.now(),
    langConfig: { ...DEFAULT_CONFIG.language, targetCode: "cmn" },
    promptConfig: structuredClone(DEFAULT_CONFIG.pageTranslation.customPromptsConfig),
    provider: {
      id: "test",
      name: "test",
      enabled: true,
      provider: "openai",
      apiKey: "test",
      model: { model: "gpt-5-mini", isCustomModel: true, customModel: "test-model" },
    },
  }
}
function setup(cancelled = new Set<string>()) {
  return createPageTranslationQueues({
    requestQueueConfig: { rate: 100, capacity: 100 },
    batchQueueConfig: { maxItemsPerBatch: 2, maxCharactersPerBatch: 4000 },
    isScopeCancelled: (scope) => cancelled.has(scope),
    maxConcurrent: 1,
  })
}
describe("page queues with real dispatch and protocol", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it("retries only the invalid item outside the occupied slot", async () => {
    mocks.generate
      .mockResolvedValueOnce({ text: '{"t0":"first translated"}' })
      .mockResolvedValueOnce({ text: "second translated" })
    const queue = setup()
    const results = Promise.all([
      queue.batchQueue.enqueue(item("first")),
      queue.batchQueue.enqueue(item("second")),
    ])
    await vi.advanceTimersByTimeAsync(100)
    expect(await results).toEqual(["first translated", "second translated"])
    expect(mocks.generate).toHaveBeenCalledTimes(2)
    expect(mocks.generate.mock.calls[1]![0].prompt).toContain("second")
    expect(mocks.generate.mock.calls[1]![0].prompt).not.toContain("first")
  })
  it("does not convert auth errors into individual fallback", async () => {
    mocks.generate.mockRejectedValue(Object.assign(new Error("Unauthorized"), { statusCode: 401 }))
    const queue = setup()
    const results = Promise.allSettled([
      queue.batchQueue.enqueue(item("first")),
      queue.batchQueue.enqueue(item("second")),
    ])
    await vi.advanceTimersByTimeAsync(100)
    expect((await results).every((x) => x.status === "rejected")).toBe(true)
    expect(mocks.generate).toHaveBeenCalledTimes(1)
  })
  it("retries a rate-limited batch after the pause without individual fallback", async () => {
    mocks.generate
      .mockRejectedValueOnce(Object.assign(new Error("Too many requests"), { statusCode: 429 }))
      .mockResolvedValueOnce({ text: '{"t0":"first translated","t1":"second translated"}' })
    const queue = setup()
    const result = Promise.all([
      queue.batchQueue.enqueue(item("first")),
      queue.batchQueue.enqueue(item("second")),
    ])
    await vi.advanceTimersByTimeAsync(100)
    expect(mocks.generate).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(15000)
    expect(await result).toEqual(["first translated", "second translated"])
    expect(mocks.generate).toHaveBeenCalledTimes(2)
    expect(mocks.generate.mock.calls[1]![0].prompt).toBe(mocks.generate.mock.calls[0]![0].prompt)
  })
  it("splits MT by encoded payload size rather than source character count", async () => {
    const fetcher = vi.fn<(...args: any[]) => any>().mockImplementation(async (_url, init) => ({
      ok: true,
      json: async () => JSON.parse(init.body).map(() => ({ translations: [{ text: "ok" }] })),
    }))
    vi.stubGlobal("fetch", fetcher)
    const queue = setup()
    const jobs = ["a", "b"].map((suffix) =>
      queue.batchQueue.enqueue({
        ...item("&".repeat(4000) + suffix),
        provider: { id: "ms", name: "MS", provider: "microsoft-translate", enabled: true },
      }),
    )
    // The second batch waits on the dispatch gate while the first occupies its slot.
    await vi.advanceTimersByTimeAsync(2000)
    expect(await Promise.all(jobs)).toEqual(["ok", "ok"])
    expect(fetcher).toHaveBeenCalledTimes(2)
    for (const [, init] of fetcher.mock.calls) {
      expect(JSON.parse(init.body)).toHaveLength(1)
      expect(new TextEncoder().encode(init.body).length).toBeLessThan(32 * 1024)
    }
  })
  it("keeps another tab alive and skips fallback for a cancelled scope", async () => {
    const cancelled = new Set<string>()
    let finish!: (value: { text: string }) => void
    mocks.generate
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValue({ text: '{"t0":"survived"}' })
    const queue = setup(cancelled)
    const a = queue.batchQueue.enqueue(item("same", "1:a")).catch(() => "cancelled")
    const b = queue.batchQueue.enqueue(item("same", "2:b"))
    await vi.advanceTimersByTimeAsync(100)
    cancelled.add("1:a")
    queue.batchQueue.cancelByScope("1:a")
    queue.requestQueue.cancelByScope("1:a")
    finish({ text: "broken" })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await a).toBe("cancelled")
    expect(await b).toBe("survived")
    expect(mocks.generate).toHaveBeenCalledTimes(2)
  })
  it("sends 100 MT items in one call and only falls back the missing position", async () => {
    const fetcher = vi.fn<(...args: any[]) => any>().mockImplementation(async (_url, init) => {
      const texts = JSON.parse(init.body)
      return {
        ok: true,
        json: async () =>
          texts.map((text: string) => ({
            translations: text === "p5" && texts.length > 1 ? [] : [{ text: `ok ${text}` }],
          })),
      }
    })
    vi.stubGlobal("fetch", fetcher)
    const queue = setup()
    const jobs = Array.from({ length: 100 }, (_, i) =>
      queue.batchQueue.enqueue({
        ...item(`p${i}`),
        provider: { id: "ms", name: "MS", provider: "microsoft-translate", enabled: true },
      }),
    )
    await vi.advanceTimersByTimeAsync(100)
    const result = await Promise.all(jobs)
    expect(result[5]).toBe("ok p5")
    expect(result).toHaveLength(100)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual(["p5"])
  })
  it("separates same text with different format or captured provider configuration", async () => {
    mocks.generate.mockResolvedValue({ text: '{"t0":"ok"}' })
    const queue = setup()
    const first = item("same")
    const second = { ...item("same"), textFormat: "html" as const }
    const third = { ...item("same"), provider: { ...item("same").provider, name: "edited" } }
    const jobs = [first, second, third].map((data) => queue.batchQueue.enqueue(data))
    await vi.advanceTimersByTimeAsync(3000)
    expect(await Promise.all(jobs)).toEqual(["ok", "ok", "ok"])
    expect(mocks.generate).toHaveBeenCalledTimes(3)
  })
})
