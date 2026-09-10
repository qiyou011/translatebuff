import { QueryClient } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sendMessage } from "@/utils/message"
import { backgroundOrpcClient } from "@/utils/orpc/background-client"
import { orpc, orpcClient } from "@/utils/orpc/client"

vi.mock("@/utils/message", () => ({
  sendMessage: vi
    .fn<() => Promise<never>>()
    .mockRejectedValue(new Error("Unexpected background request")),
}))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("Unexpected fetch")))
})
afterEach(() => vi.unstubAllGlobals())

describe("disabled ORPC exits", () => {
  it("rejects UI and native-background ordinary calls locally", async () => {
    for (const client of [orpcClient, backgroundOrpcClient]) {
      await expect(client.hostedAi.status({})).rejects.toMatchObject({
        code: "UPSTREAM_CLOUD_DISABLED",
        isRetryable: false,
      })
      await expect(client.notebase.list({})).rejects.toMatchObject({
        code: "UPSTREAM_CLOUD_DISABLED",
      })
    }
    expect(fetch).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("preserves query helper shape but does not run its query remotely", async () => {
    const options = orpc.hostedAi.status.queryOptions({ input: {} })
    expect(options.queryKey).toBeDefined()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await expect(client.fetchQuery(options)).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
    })
    expect(client.isFetching()).toBe(0)
    client.clear()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("rejects a streaming call before fetching or creating an iterator", async () => {
    await expect(
      backgroundOrpcClient.hostedAi.translate.streamText({
        modelTier: "normal",
        requestId: "test-request",
        instructions: "Translate",
        prompt: "Test",
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_CLOUD_DISABLED", isRetryable: false })
    expect(fetch).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
