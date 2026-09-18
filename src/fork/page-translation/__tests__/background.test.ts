import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { setUpWebPageTranslationQueue } from "@/entrypoints/background/translation-queues"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { createPageTranslationQueues } from "../queues"

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (message: any) => Promise<any>>(),
  generate: vi.fn<(...args: any[]) => any>(),
  put: vi.fn<(...args: any[]) => any>(),
  get: vi.fn<(...args: any[]) => any>(),
  init: vi.fn<(...args: any[]) => any>(),
  execute: vi.fn<(...args: any[]) => any>(),
  summary: vi.fn<(...args: any[]) => any>(),
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
vi.mock("@/utils/content/summary", () => ({ generateArticleSummary: mocks.summary }))
vi.mock("@/utils/host/translate/execute-translate", () => ({ executeTranslate: mocks.execute }))
vi.mock("ai", () => ({ generateText: mocks.generate }))
vi.mock("@/utils/providers/model", () => ({ getLanguageModelForConfig: () => "captured-model" }))

beforeEach(async () => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.handlers.clear()
  mocks.get.mockResolvedValue(undefined)
  const config = structuredClone(DEFAULT_CONFIG)
  config.pageTranslation.batchQueueConfig = { maxItemsPerBatch: 1, maxCharactersPerBatch: 4000 }
  mocks.init.mockResolvedValue(config)
  await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, config)
})
afterEach(() => {
  vi.useRealTimers()
})
function message(text: string, feature = "pageTranslation") {
  return {
    sender: { tab: { id: 1 } },
    data: {
      text,
      hash: text,
      scheduleAt: Date.now(),
      sessionId: "session",
      hostedFeature: feature,
      langConfig: { ...DEFAULT_CONFIG.language, targetCode: "cmn" },
      providerRef: {
        kind: "local",
        config: {
          id: "test",
          name: "test",
          enabled: true,
          provider: "openai",
          apiKey: "test",
          model: { model: "gpt-5-mini", isCustomModel: true, customModel: "test-model" },
        },
      },
    },
  }
}
it("routes input immediately even while the page lane is occupied", async () => {
  let finish!: (value: any) => void
  mocks.generate.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  mocks.execute.mockResolvedValue("input translated")
  setUpWebPageTranslationQueue(createPageTranslationQueues)
  const translate = mocks.handlers.get("enqueueTranslateRequest")!
  const page = translate(message("page"))
  await vi.advanceTimersByTimeAsync(100)
  expect(mocks.generate).toHaveBeenCalledTimes(1)
  const input = translate(message("input", "inputTranslation"))
  await vi.advanceTimersByTimeAsync(0)
  expect(await input).toBe("input translated")
  finish({ text: '{"t0":"page translated"}' })
  await vi.advanceTimersByTimeAsync(0)
  expect(await page).toBe("page translated")
})

it.each(["formula lost", "{{0}} {{0}}", "{{0}} {{9}}"])(
  "does not persist damaged formula tokens through the injected fork queue: %s",
  async (result) => {
    mocks.generate.mockResolvedValue({ text: JSON.stringify({ t0: result }) })
    setUpWebPageTranslationQueue(createPageTranslationQueues)
    const request = mocks.handlers.get("enqueueTranslateRequest")!(message("Formula {{0}}"))
    await vi.advanceTimersByTimeAsync(100)
    expect(await request).toBe(result)
    expect(mocks.put).not.toHaveBeenCalled()
  },
)

it("persists the formula sentinel through the injected fork queue", async () => {
  mocks.generate.mockResolvedValue({ text: '{"t0":"{{NO_TRANSLATION_NEEDED}}"}' })
  setUpWebPageTranslationQueue(createPageTranslationQueues)
  const request = mocks.handlers.get("enqueueTranslateRequest")!(message("Formula {{0}}"))
  await vi.advanceTimersByTimeAsync(100)
  expect(await request).toBe("{{NO_TRANSLATION_NEEDED}}")
  expect(mocks.put).toHaveBeenCalledWith(
    expect.objectContaining({ translation: "{{NO_TRANSLATION_NEEDED}}" }),
  )
})
it("does not cache a late response for a cancelled page", async () => {
  let finish!: (value: any) => void
  mocks.generate.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  setUpWebPageTranslationQueue(createPageTranslationQueues)
  const promise = mocks.handlers.get("enqueueTranslateRequest")!(message("page")).catch(
    () => "cancelled",
  )
  await vi.advanceTimersByTimeAsync(100)
  await mocks.handlers.get("cancelPageTranslationRequests")!({
    sender: { tab: { id: 1 } },
    data: { sessionId: "session" },
  })
  finish({ text: '{"t0":"late"}' })
  await vi.advanceTimersByTimeAsync(0)
  expect(await promise).toBe("cancelled")
  expect(mocks.put).not.toHaveBeenCalled()
})

it("reuses a cached HTML sentinel instead of treating it as missing markers", async () => {
  mocks.get.mockResolvedValue({ translation: "{{NO_TRANSLATION_NEEDED}}" })
  mocks.generate.mockResolvedValue({ text: '{"t0":"{{NO_TRANSLATION_NEEDED}}"}' })
  setUpWebPageTranslationQueue(createPageTranslationQueues)
  const request = message('<a data-rf-attr="0">中文</a>')
  const pending = mocks.handlers.get("enqueueTranslateRequest")!({
    ...request,
    data: { ...request.data, textFormat: "html" },
  })
  await vi.advanceTimersByTimeAsync(100)
  expect(await pending).toBe("{{NO_TRANSLATION_NEEDED}}")
  expect(mocks.generate).not.toHaveBeenCalled()
})

it("routes an input preflight summary around a saturated page queue", async () => {
  const finish: ((value: any) => void)[] = []
  mocks.generate.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish.push(resolve)
      }),
  )
  mocks.summary.mockResolvedValue("input summary")
  setUpWebPageTranslationQueue(createPageTranslationQueues)
  const translate = mocks.handlers.get("enqueueTranslateRequest")!
  const pages = [0, 1, 2, 3].map((id) => translate(message(`page-${id}`)))
  await vi.advanceTimersByTimeAsync(100)
  let completed = false
  const summary = mocks.handlers.get("getOrGenerateWebPageSummary")!({
    data: {
      webTitle: "title",
      webContent: "content",
      hostedFeature: "inputTranslation",
      providerRef: message("input").data.providerRef,
    },
  }).then((result) => {
    completed = true
    return result
  })
  await vi.advanceTimersByTimeAsync(0)
  const completedWhileSaturated = completed
  for (const resolve of finish) resolve({ text: '{"t0":"translated"}' })
  await vi.advanceTimersByTimeAsync(100)
  await Promise.all(pages)
  expect(await summary).toBe("input summary")
  expect(completedWhileSaturated).toBe(true)
})
