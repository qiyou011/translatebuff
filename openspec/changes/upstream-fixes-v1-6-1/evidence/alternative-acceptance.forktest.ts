import type { ServerResponse } from "node:http"
import type { PageTranslationData } from "@/fork/page-translation/types"
import { createServer } from "node:http"
import { TextEncoder as NativeTextEncoder } from "node:util"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { adoptCredential, clearMembership } from "@/fork/background/membership"
import { loadMembershipInfo } from "@/fork/membership/membership-info"
import { loadForkSession } from "@/fork/membership/session"
import { createPageTranslationQueues } from "@/fork/page-translation/queues"
import { buildRenyimiaoProvider, renyimiaoApiKey } from "@/fork/providers/renyimiao"
import { configSchema } from "@/types/config/config"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"

// Only persistence of request statistics is outside this contract. The membership
// client, provider factory, AI SDK, HTTP transport, queue and decoder remain real.
vi.mock("@/utils/batch-request-record", () => ({ putBatchRequestRecord: async () => {} }))

const credential = "local-acceptance-credential"
const apiKey = "local-acceptance-key"
const nativeFetch = globalThis.fetch
const testEncoder = globalThis.TextEncoder
let server: ReturnType<typeof createServer>
let base: string
let unauthorized: boolean
let holdTokens: boolean
let releaseTokens: (() => void) | undefined
let omitSecondResult: boolean
let externalRequests: string[]
let requests: Array<{
  path: string
  credential?: string
  authorization?: string
  prompt?: string
  instructions?: string
  items?: number
}>

function reply(response: ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" })
  response.end(JSON.stringify(body))
}

async function config() {
  return storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
}

function item(text: string): PageTranslationData {
  return {
    text,
    hash: text,
    scope: "acceptance:page",
    scheduleAt: Date.now(),
    langConfig: { ...DEFAULT_CONFIG.language, targetCode: "cmn" },
    promptConfig: structuredClone(DEFAULT_CONFIG.pageTranslation.customPromptsConfig),
    provider: buildRenyimiaoProvider("fixture-model", apiKey, `${base}/v1`),
  }
}

function queue() {
  return createPageTranslationQueues({
    requestQueueConfig: { capacity: 100, rate: 100 },
    batchQueueConfig: { maxItemsPerBatch: 2, maxCharactersPerBatch: 4000 },
    isScopeCancelled: () => false,
    maxConcurrent: 1,
  }).batchQueue
}

beforeEach(async () => {
  // The shared jsdom shim truncates UTF-8. This Node HTTP suite needs the
  // platform encoder so Content-Length and the transmitted bytes agree.
  vi.stubGlobal("TextEncoder", NativeTextEncoder)
  fakeBrowser.reset()
  requests = []
  externalRequests = []
  unauthorized = false
  holdTokens = false
  releaseTokens = undefined
  omitSecondResult = false
  server = createServer(async (request, response) => {
    const path = new URL(request.url!, base).pathname
    const row: (typeof requests)[number] = {
      path,
      credential: request.headers["login-credential"] as string | undefined,
      authorization: request.headers.authorization,
    }
    requests.push(row)
    if (path.endsWith("/login_status")) {
      reply(
        response,
        unauthorized ? {} : { data: { member: { email: "fixture@example.test" } } },
        unauthorized ? 401 : 200,
      )
    } else if (path.endsWith("/tokens")) {
      const finish = () =>
        reply(response, {
          data: {
            base_url: base,
            tokens: [
              {
                sk_key: apiKey,
                token_name: "subscription",
                expired_time: -1,
                priority: 50,
                remain_quota: 1234,
              },
            ],
          },
        })
      if (holdTokens) releaseTokens = finish
      else finish()
    } else if (path === "/v1/models") {
      reply(response, { data: [{ id: "fixture-model" }] })
    } else if (path === "/v1/chat/completions") {
      let body = ""
      for await (const chunk of request) body += chunk
      const payload = JSON.parse(body)
      row.prompt = payload.messages.at(-1).content
      row.instructions =
        payload.messages.find((message: { role: string }) => message.role === "system")?.content ??
        ""
      const start = row.prompt!.indexOf('{"t0"')
      let output = "第二译文"
      if (start >= 0) {
        const input: Record<string, string> = JSON.parse(
          row.prompt!.slice(start, row.prompt!.lastIndexOf("}") + 1),
        )
        row.items = Object.keys(input).length
        const result = Object.fromEntries(
          Object.entries(input).map(([key, value]) => [
            key,
            value === "Frog"
              ? row.instructions!.includes("Frog => 新词")
                ? "新词"
                : "Frog"
              : `${value} 中文`,
          ]),
        )
        if (omitSecondResult) {
          delete result.t1
          omitSecondResult = false
        }
        output = JSON.stringify(result)
      }
      reply(response, {
        id: "fixture",
        object: "chat.completion",
        created: 1,
        model: "fixture-model",
        choices: [
          { index: 0, message: { role: "assistant", content: output }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })
    } else reply(response, { error: "Unexpected fixture endpoint" }, 404)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Missing fixture port")
  base = `http://127.0.0.1:${address.port}`
  vi.stubEnv("WXT_RENYIMIAO_API_URL", base)
  vi.stubEnv("WXT_FORK_EDITION", "cn")
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    )
    if (url.origin !== base) {
      externalRequests.push(url.origin + url.pathname)
      return Promise.reject(new Error("External network disabled in acceptance"))
    }
    // Node fetch may have cached the shared setup's jsdom encoder already.
    // Explicit UTF-8 bytes preserve the SDK's JSON while avoiding that shim.
    return nativeFetch(
      input,
      init && typeof init.body === "string"
        ? { ...init, body: Buffer.from(init.body, "utf8") }
        : init,
    )
  })
})

afterEach(async () => {
  try {
    if (externalRequests.length > 0) throw new Error("Unexpected external network request")
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    vi.stubGlobal("fetch", nativeFetch)
    vi.stubGlobal("TextEncoder", testEncoder)
    vi.unstubAllEnvs()
  }
})

describe("alternative acceptance over real localhost HTTP", () => {
  it("carries login, PRO state, dynamic models and a batched translation through real clients", async () => {
    await adoptCredential(credential)
    expect((await loadForkSession())?.email).toBe("fixture@example.test")
    expect(await loadMembershipInfo()).toMatchObject({ tier: "pro", remainQuota: 1234 })
    const provider = (await config()).providersConfig.find(
      (entry) => entry.id === "renyimiao-fixture-model",
    )
    expect(provider).toMatchObject({ apiKey, baseURL: `${base}/v1` })
    const batch = queue()
    const one = { ...item("first"), provider: provider! }
    const two = { ...item("second"), provider: provider! }
    expect(await Promise.all([batch.enqueue(one), batch.enqueue(two)])).toEqual([
      "first 中文",
      "second 中文",
    ])
    const chats = requests.filter((row) => row.path.endsWith("chat/completions"))
    expect(chats).toHaveLength(1)
    expect(chats[0]).toMatchObject({ items: 2, authorization: `Bearer ${apiKey}` })
    expect(requests.find((row) => row.path.endsWith("login_status"))?.credential).toBe(credential)
    await clearMembership()
    expect(await loadForkSession()).toBeNull()
    expect(await loadMembershipInfo()).toBeNull()
    expect(renyimiaoApiKey((await config()).providersConfig)).toBe("")
  })

  it("clears an existing session and provider key after a real HTTP 401", async () => {
    await adoptCredential(credential)
    expect(renyimiaoApiKey((await config()).providersConfig)).toBe(apiKey)
    unauthorized = true
    await adoptCredential("expired-local-credential")
    expect(await loadForkSession()).toBeNull()
    expect(await loadMembershipInfo()).toBeNull()
    expect(renyimiaoApiKey((await config()).providersConfig)).toBe("")
  })

  it("does not restore a logged-out session when the HTTP token response arrives late", async () => {
    holdTokens = true
    const pending = adoptCredential(credential)
    await vi.waitFor(() => expect(releaseTokens).toBeTypeOf("function"))
    await clearMembership()
    releaseTokens!()
    await pending
    expect(await loadForkSession()).toBeNull()
    expect(renyimiaoApiKey((await config()).providersConfig)).toBe("")
    expect(requests.some((row) => row.path === "/v1/models")).toBe(false)
  })

  it("sends separate HTTP requests after terminology is edited and deleted", async () => {
    const batch = queue()
    const edited = {
      ...item("Frog"),
      glossaryRevision: 2,
      glossaryTerms: [{ matchKey: "frog", source: "Frog", target: "新词", keepOriginal: false }],
    }
    const deleted = { ...item("Frog"), glossaryRevision: 3, glossaryTerms: [] }
    expect(await Promise.all([batch.enqueue(edited), batch.enqueue(deleted)])).toEqual([
      "新词",
      "Frog",
    ])
    const chats = requests.filter((row) => row.path.endsWith("chat/completions"))
    expect(chats).toHaveLength(2)
    expect(chats.every((row) => row.items === 1)).toBe(true)
    expect(chats.filter((row) => row.instructions?.includes("Frog => 新词"))).toHaveLength(1)
  })

  it("reissues only the missing translation item over HTTP", async () => {
    omitSecondResult = true
    const batch = queue()
    expect(
      await Promise.all([batch.enqueue(item("first")), batch.enqueue(item("second"))]),
    ).toEqual(["first 中文", "第二译文"])
    const chats = requests.filter((row) => row.path.endsWith("chat/completions"))
    expect(chats).toHaveLength(2)
    expect(chats[0]?.items).toBe(2)
    expect(chats[1]?.prompt).toContain("second")
    expect(chats[1]?.prompt).not.toContain("first")
  })
})
