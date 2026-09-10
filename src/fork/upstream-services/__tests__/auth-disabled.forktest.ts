// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { authClient } from "@/utils/auth/auth-client"
import { backgroundAuthClient } from "@/utils/auth/background-auth-client"
import { sendMessage } from "@/utils/message"

vi.mock("@/utils/message", () => ({
  sendMessage: vi
    .fn<() => Promise<never>>()
    .mockRejectedValue(new Error("Unexpected background request")),
}))

beforeEach(() => {
  fakeBrowser.reset()
  vi.clearAllMocks()
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("Unexpected fetch")))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("disabled upstream auth", () => {
  it("reads an empty background and UI session without touching credentials or network", async () => {
    await fakeBrowser.storage.local.set({ forkTestCredential: "retained-test-value" })
    const before = await fakeBrowser.storage.local.get(null)
    expect(await authClient.getSession()).toMatchObject({ data: null, error: null })
    expect(await backgroundAuthClient.getSession()).toMatchObject({ data: null, error: null })
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before)
    expect(fetch).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("renders an immediately settled session hook", () => {
    const { result } = renderHook(() => authClient.useSession())
    expect(result.current).toMatchObject({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("rejects unsupported sign-out rather than reporting success", async () => {
    await expect(authClient.signOut()).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
      isRetryable: false,
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
