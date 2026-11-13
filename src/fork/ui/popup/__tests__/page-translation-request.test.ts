import { afterEach, describe, expect, it, vi } from "vitest"
import { requestPageTranslation } from "../page-translation-request"

const send = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>())
vi.mock("@/utils/message", () => ({ sendMessage: send }))
afterEach(() => {
  vi.useRealTimers()
  send.mockReset()
})

describe("page translation acknowledgement", () => {
  it("waits for the actual manager state, and also confirms restoration", async () => {
    vi.useFakeTimers()
    send.mockResolvedValueOnce(undefined).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const done = vi.fn<(...args: unknown[]) => void>()
    const request = requestPageTranslation(9, true, new AbortController().signal).then(done)
    await vi.advanceTimersByTimeAsync(0)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    await request
    expect(done).toHaveBeenCalledWith(true)
    send.mockResolvedValueOnce(undefined).mockResolvedValueOnce(false)
    await expect(requestPageTranslation(9, false, new AbortController().signal)).resolves.toBe(
      false,
    )
  })

  it("rejects missing content, service failures and cancelled responses", async () => {
    send.mockRejectedValueOnce(new Error("No receiver"))
    await expect(requestPageTranslation(9, true, new AbortController().signal)).rejects.toThrow(
      "No receiver",
    )
    vi.useFakeTimers()
    send.mockResolvedValue(false)
    const request = requestPageTranslation(9, true, new AbortController().signal)
    const assertion = (async () => {
      await expect(request).rejects.toThrow("did not acknowledge")
    })()
    await vi.runAllTimersAsync()
    await assertion
    const controller = new AbortController()
    controller.abort()
    await expect(requestPageTranslation(9, true, controller.signal)).rejects.toThrow("aborted")
  })
})
