import type { Config } from "@/types/config/config"
import type { MatchedTerm } from "@/utils/glossary/types"
import { writeFileSync } from "node:fs"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { setupPageTranslationHandlers } from "@/entrypoints/background/page-translation"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { configSchema } from "@/types/config/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { PAGE_LLM_BATCH_CANDIDATE } from "../policy"
import { createPageTranslationQueues } from "../queues"

interface GatewayRequest {
  model: string
  messages: { role: string; content: string }[]
  response_format?: { type: string }
}

interface RequestMessage {
  sender: { tab: { id: number } }
  data: {
    text: string
    textFormat: "html"
    hash: string
    scheduleAt: number
    sessionId: string
    hostedFeature: "pageTranslation"
    langConfig: Config["language"]
    providerRef: { kind: "local"; config: ReturnType<typeof buildRenyimiaoProvider> }
    glossaryTerms: MatchedTerm[]
    glossaryRevision: number
  }
}

interface CacheRow {
  key: string
  translation: string
  createdAt: Date
}

const boundary = vi.hoisted(() => ({
  handlers: new Map<string, (message: RequestMessage) => Promise<string>>(),
  cache: new Map<string, CacheRow>(),
  writes: [] as CacheRow[],
  batchRecords: [] as { originalRequestCount: number }[],
  config: undefined as Config | undefined,
}))

// Only browser messaging, initialized storage and DB boundaries are replaced.
// BatchQueue, RequestQueue, prompt/wire code, provider factory and AI SDK are real.
vi.mock("@/utils/message", () => ({
  onMessage: (name: string, handler: (message: RequestMessage) => Promise<string>) =>
    boundary.handlers.set(name, handler),
}))
vi.mock("@/entrypoints/background/config", () => ({
  ensureInitializedConfig: async () => boundary.config,
}))
vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    translationCache: {
      get: async (key: string) => boundary.cache.get(key),
      put: async (row: CacheRow) => {
        boundary.writes.push(row)
        boundary.cache.set(row.key, row)
      },
      delete: async (key: string) => boundary.cache.delete(key),
    },
    batchRequestRecord: {
      put: async (row: { originalRequestCount: number }) => boundary.batchRecords.push(row),
    },
    articleSummaryCache: { get: async () => undefined, put: async () => {} },
  },
}))

const provider = buildRenyimiaoProvider(
  "cost-preservation-model",
  "fixture-key",
  "https://llm-preservation.invalid/v1",
)
const requests: GatewayRequest[] = []
const evidence: unknown[] = []
let respond: (request: GatewayRequest, call: number) => string

function userText(request: GatewayRequest): string {
  return request.messages
    .filter((part) => part.role === "user")
    .map((part) => part.content)
    .join("\n")
}

function flatInput(request: GatewayRequest): Record<string, string> | null {
  const user = userText(request)
  const start = user.indexOf('{"t0":')
  return start < 0 ? null : (JSON.parse(user.slice(start)) as Record<string, string>)
}

function translateSource(source: string): string {
  return source.replaceAll("Source", "译文")
}

function validReply(request: GatewayRequest): string {
  const flat = flatInput(request)
  if (flat) {
    return JSON.stringify(
      Object.fromEntries(Object.entries(flat).map(([key, value]) => [key, translateSource(value)])),
    )
  }
  const user = userText(request)
  const source = user.slice(user.indexOf("<a "))
  return translateSource(source)
}

function message(index: number, terms: MatchedTerm[] = []): RequestMessage {
  return {
    sender: { tab: { id: 91 } },
    data: {
      text: `<a data-rf-attr="0">Source ${index}</a>`,
      textFormat: "html",
      hash: `llm-preservation-${index}`,
      scheduleAt: Date.now(),
      sessionId: "cost-preservation-session",
      hostedFeature: "pageTranslation",
      langConfig: { ...DEFAULT_CONFIG.language, targetCode: "cmn" },
      providerRef: { kind: "local", config: structuredClone(provider) },
      glossaryTerms: terms,
      glossaryRevision: 7,
    },
  }
}

async function setup(promptConfig?: Config["pageTranslation"]["customPromptsConfig"]) {
  const config = structuredClone(DEFAULT_CONFIG)
  config.providersConfig.push(provider)
  config.pageTranslation.providerId = provider.id
  config.pageTranslation.batchQueueConfig = { ...PAGE_LLM_BATCH_CANDIDATE }
  if (promptConfig) config.pageTranslation.customPromptsConfig = promptConfig
  boundary.config = configSchema.parse(config)
  await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, boundary.config)
  setupPageTranslationHandlers(createPageTranslationQueues)
  return boundary.handlers.get("enqueueTranslateRequest")!
}

async function settle() {
  await vi.advanceTimersByTimeAsync(1000)
}

beforeEach(() => {
  vi.useFakeTimers()
  boundary.handlers.clear()
  boundary.cache.clear()
  boundary.writes.length = 0
  boundary.batchRecords.length = 0
  requests.length = 0
  respond = validReply
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url !== "https://llm-preservation.invalid/v1/chat/completions") {
        throw new Error("Unexpected request outside the fixture gateway")
      }
      const body = input instanceof Request ? await input.text() : init?.body
      if (typeof body !== "string") throw new Error("Expected JSON gateway request body")
      const request = JSON.parse(body) as GatewayRequest
      requests.push(request)
      // Supply real HTTP bytes: the shared Vitest TextEncoder shim truncates
      // non-ASCII code units when Response(string) tries to encode this body.
      return new Response(
        Buffer.from(
          JSON.stringify({
            id: `fixture-${requests.length}`,
            object: "chat.completion",
            created: 1,
            model: request.model,
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: respond(request, requests.length) },
                finish_reason: "stop",
              },
            ],
          }),
          "utf8",
        ),
        { headers: { "content-type": "application/json" } },
      )
    }),
  )
})

afterEach(() => {
  const evidencePath = process.env.LLM_COST_EVIDENCE
  if (evidencePath) {
    evidence.push({
      test: expect.getState().currentTestName,
      httpCalls: requests.length,
      requests: requests.map((request) => ({
        ...request,
        promptCharacters: request.messages.reduce((sum, part) => sum + part.content.length, 0),
        promptUtf8Bytes: Buffer.byteLength(request.messages.map((part) => part.content).join("")),
      })),
      cacheWrites: structuredClone(boundary.writes),
      originalRequestsPerCall: boundary.batchRecords.map((record) => record.originalRequestCount),
      modelTokens: null,
      tokenLimit: "No model tokenizer or real gateway usage measured; character/byte counts only.",
    })
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)
  }
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("fork LLM cost protocol through background, real queues and SDK HTTP", () => {
  it("sends sixteen compatible default HTML paragraphs in one compact call and reuses accepted cache", async () => {
    const enqueue = await setup()
    const inputs = Array.from({ length: 16 }, (_, index) => message(index))
    const result = Promise.all(inputs.map(enqueue))
    await settle()
    expect(await result).toEqual(inputs.map((input) => translateSource(input.data.text)))
    expect(requests).toHaveLength(1)
    expect(Object.keys(flatInput(requests[0]!)!)).toHaveLength(16)
    expect(userText(requests[0]!)).toContain("<a id=0>Source 0</a>")
    expect(userText(requests[0]!)).not.toContain("data-rf-attr")
    expect(requests[0]!.response_format).toEqual({ type: "json_object" })
    expect(boundary.writes).toHaveLength(16)
    expect(boundary.batchRecords.map((record) => record.originalRequestCount)).toEqual([16])
    await Promise.all(inputs.map(enqueue))
    expect(requests).toHaveLength(1)
  })

  it.each([1, 2, 16])(
    "isolates sixteen same-revision paragraphs into %s effective terminology groups",
    async (groups) => {
      const enqueue = await setup()
      const result = Promise.all(
        Array.from({ length: 16 }, (_, index) =>
          enqueue(
            message(index, [
              {
                matchKey: "source",
                source: "Source",
                target: `术语组${index % groups}`,
                keepOriginal: false,
              },
            ]),
          ),
        ),
      )
      await settle()
      expect(await result).toHaveLength(16)
      expect(requests).toHaveLength(groups)
      expect(boundary.batchRecords.map((record) => record.originalRequestCount)).toEqual(
        Array.from({ length: groups }, () => 16 / groups),
      )
      expect(
        requests.every((request) =>
          request.messages.some((part) => part.content.includes("Source => 术语组")),
        ),
      ).toBe(true)
    },
  )

  it("keeps a custom template batched with canonical markers and the legacy separator", async () => {
    const enqueue = await setup({
      promptId: "preservation-custom",
      patterns: [
        {
          id: "preservation-custom",
          name: "Custom",
          systemPrompt: "MY CUSTOM SYSTEM",
          prompt: "CUSTOM_INPUT\n{{input}}",
        },
      ],
    })
    const result = Promise.all(Array.from({ length: 16 }, (_, index) => enqueue(message(index))))
    await settle()
    expect(await result).toHaveLength(16)
    expect(requests).toHaveLength(1)
    expect(userText(requests[0]!)).toContain('CUSTOM_INPUT\n<a data-rf-attr="0">Source 0</a>')
    expect(userText(requests[0]!).match(/^%%$/gm)).toHaveLength(15)
    expect(requests[0]!.messages.some((part) => part.content.includes("MY CUSTOM SYSTEM"))).toBe(
      true,
    )
    expect(requests[0]!.response_format).toBeUndefined()
  })

  it("falls back only a non-string JSON field once and never caches its corrupt value", async () => {
    respond = (request, call) => {
      if (call !== 1) return validReply(request)
      const output = JSON.parse(validReply(request)) as Record<string, unknown>
      output.t7 = 42
      return JSON.stringify(output)
    }
    const enqueue = await setup()
    const result = Promise.all(Array.from({ length: 16 }, (_, index) => enqueue(message(index))))
    await settle()
    expect(await result).toHaveLength(16)
    expect(requests).toHaveLength(2)
    expect(userText(requests[1]!)).toContain('data-rf-attr="0">Source 7')
    expect(userText(requests[1]!)).not.toContain("Source 6")
    expect(boundary.batchRecords.map((record) => record.originalRequestCount)).toEqual([16, 1])
    expect(boundary.writes).toHaveLength(16)
    expect(boundary.writes.every((row) => row.translation.includes('data-rf-attr="0"'))).toBe(true)
  })

  it("rejects a damaged marker after one individual fallback without caching it or resending good items", async () => {
    respond = (request, call) => {
      if (call !== 1) return "<a>still-invalid</a>"
      const output = JSON.parse(validReply(request)) as Record<string, string>
      output.t1 = "<b id=0>bad-marker</b>"
      return JSON.stringify(output)
    }
    const enqueue = await setup()
    const result = Promise.allSettled([enqueue(message(0)), enqueue(message(1))])
    await settle()
    expect((await result).map((item) => item.status)).toEqual(["fulfilled", "rejected"])
    expect(requests).toHaveLength(2)
    expect(userText(requests[1]!)).toContain("Source 1")
    expect(userText(requests[1]!)).not.toContain("Source 0")
    expect(boundary.writes).toHaveLength(1)
    expect(boundary.cache.has("llm-preservation-1")).toBe(false)
    expect(boundary.writes[0]!.translation).toBe('<a data-rf-attr="0">译文 0</a>')
  })

  it("does not retry a corrupt JSON batch and falls back each affected item once", async () => {
    respond = (request, call) => (call === 1 ? "not-json" : validReply(request))
    const enqueue = await setup()
    const result = Promise.all([enqueue(message(0)), enqueue(message(1))])
    await settle()
    expect(await result).toHaveLength(2)
    expect(requests).toHaveLength(3)
    expect(boundary.batchRecords.map((record) => record.originalRequestCount)).toEqual([2, 1, 1])
    expect(boundary.writes).toHaveLength(2)
  })

  it("retains the custom template and canonical input in individual marker fallback", async () => {
    respond = (request, call) =>
      call === 1 ? '<a data-rf-attr="0">译文 0</a>\n\n%%\n\n<a>bad</a>' : validReply(request)
    const enqueue = await setup({
      promptId: "preservation-custom",
      patterns: [
        {
          id: "preservation-custom",
          name: "Custom",
          systemPrompt: "MY CUSTOM SYSTEM",
          prompt: "CUSTOM_INPUT\n{{input}}",
        },
      ],
    })
    const result = Promise.all([enqueue(message(0)), enqueue(message(1))])
    await settle()
    expect(await result).toEqual([
      '<a data-rf-attr="0">译文 0</a>',
      '<a data-rf-attr="0">译文 1</a>',
    ])
    expect(requests).toHaveLength(2)
    expect(userText(requests[1]!)).toBe('CUSTOM_INPUT\n<a data-rf-attr="0">Source 1</a>')
    expect(requests[1]!.messages.some((part) => part.content.includes("MY CUSTOM SYSTEM"))).toBe(
      true,
    )
    expect(requests[1]!.response_format).toBeUndefined()
    expect(boundary.writes).toHaveLength(2)
  })
})
