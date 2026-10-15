import type { PageTranslationData } from "../types"
import type { MatchedTerm } from "@/utils/glossary/types"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { createPageTranslationQueues } from "../queues"

const mocks = vi.hoisted(() => ({ generate: vi.fn<(...args: any[]) => any>() }))
vi.mock("ai", () => ({ generateText: mocks.generate }))
vi.mock("@/utils/providers/model", () => ({ getLanguageModelForConfig: () => "local-model" }))
vi.mock("@/utils/batch-request-record", () => ({ putBatchRequestRecord: async () => {} }))

const term = (source: string, target: string): MatchedTerm => ({
  matchKey: source.toLowerCase(),
  source,
  target,
  keepOriginal: target === "",
})
function item(text: string, terms: MatchedTerm[], revision = 1): PageTranslationData {
  return {
    text,
    hash: text,
    scheduleAt: Date.now(),
    scope: "1:page",
    langConfig: { ...DEFAULT_CONFIG.language, targetCode: "cmn" },
    provider: {
      id: "user-provider",
      name: "User provider",
      enabled: true,
      provider: "openai-compatible",
      apiKey: "test",
      baseURL: "https://user-provider.test/v1",
      model: { model: "use-custom-model", isCustomModel: true, customModel: "my-model" },
    },
    promptConfig: structuredClone(DEFAULT_CONFIG.pageTranslation.customPromptsConfig),
    glossaryTerms: terms,
    glossaryRevision: revision,
  }
}
function queue() {
  return createPageTranslationQueues({
    requestQueueConfig: { rate: 100, capacity: 100 },
    batchQueueConfig: { maxItemsPerBatch: 2, maxCharactersPerBatch: 4000 },
    isScopeCancelled: () => false,
  }).batchQueue
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
})

it("batches equal terminology snapshots regardless of term order for a user provider", async () => {
  mocks.generate.mockResolvedValue({ text: '{"t0":"青蛙","t1":"Read Frog"}' })
  const batch = queue()
  const result = Promise.all([
    batch.enqueue(item("Frog and Read Frog", [term("Frog", "青蛙"), term("Read Frog", "")])),
    batch.enqueue(item("Read Frog", [term("Read Frog", ""), term("Frog", "青蛙")])),
  ])
  await vi.advanceTimersByTimeAsync(100)
  expect(await result).toEqual(["青蛙", "Read Frog"])
  expect(mocks.generate).toHaveBeenCalledTimes(1)
  const instructions = mocks.generate.mock.calls[0]![0].instructions
  expect(instructions).toContain("Frog => 青蛙")
  expect(instructions).toContain("Read Frog => KEEP ORIGINAL")
  expect(instructions.match(/Frog => 青蛙/g)).toHaveLength(1)
})

it("does not deduplicate or batch the same paragraph across edited and deleted revisions", async () => {
  mocks.generate.mockImplementation(({ instructions }: { instructions: string }) => ({
    text: JSON.stringify({ t0: instructions.includes("Frog => 新词") ? "新词" : "Frog" }),
  }))
  const batch = queue()
  const result = Promise.all([
    batch.enqueue(item("Frog", [term("Frog", "新词")], 2)),
    batch.enqueue(item("Frog", [], 3)),
  ])
  await vi.advanceTimersByTimeAsync(100)
  expect(await result).toEqual(["新词", "Frog"])
  expect(mocks.generate).toHaveBeenCalledTimes(2)
  expect(mocks.generate.mock.calls[1]![0].instructions).not.toContain("Terminology:")
})

it("keeps the shared terminology snapshot through individual fallback", async () => {
  mocks.generate
    .mockResolvedValueOnce({ text: '{"t0":"青蛙"}' })
    .mockResolvedValueOnce({ text: "青蛙 second" })
  const batch = queue()
  const result = Promise.all([
    batch.enqueue(item("Frog first", [term("Frog", "青蛙")])),
    batch.enqueue(item("Frog second", [term("Frog", "青蛙")])),
  ])
  await vi.advanceTimersByTimeAsync(100)
  expect(await result).toEqual(["青蛙", "青蛙 second"])
  expect(mocks.generate).toHaveBeenCalledTimes(2)
  const fallback = mocks.generate.mock.calls[1]![0]
  expect(fallback.instructions).toContain("Frog => 青蛙")
  expect(fallback.prompt).toContain("Frog second")
  expect(fallback.prompt).not.toContain("Frog first")
})

it("keeps different site-scope terminology snapshots separate at the same revision and session", async () => {
  mocks.generate.mockImplementation(({ instructions }: { instructions: string }) => ({
    text: JSON.stringify({
      t0: instructions.includes("Frog => 甲")
        ? "甲"
        : instructions.includes("Frog => 乙")
          ? "乙"
          : "unconstrained",
    }),
  }))
  const batch = queue()
  const result = Promise.all([
    batch.enqueue(item("Frog one", [term("Frog", "甲")])),
    batch.enqueue(item("Frog two", [term("Frog", "乙")])),
  ])
  await vi.advanceTimersByTimeAsync(100)
  expect(await result).toEqual(["甲", "乙"])
  expect(mocks.generate).toHaveBeenCalledTimes(2)
  expect(mocks.generate.mock.calls[0]![0].instructions).toContain("Frog => 甲")
  expect(mocks.generate.mock.calls[1]![0].instructions).toContain("Frog => 乙")
})
