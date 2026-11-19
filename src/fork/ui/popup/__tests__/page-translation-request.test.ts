import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { requestPageTranslation } from "../page-translation-request"

const frames = vi.hoisted(() => vi.fn<() => Promise<{ frameId: number }[]>>())

const status = vi.hoisted(() =>
  vi.fn<() => Promise<{ translated: boolean; failed: boolean; pending?: boolean }>>(),
)
vi.mock("@/fork/message", () => ({ sendForkMessage: status }))
const send = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>())
vi.mock("@/utils/message", () => ({ sendMessage: send }))
beforeEach(() => {
  vi.spyOn(browser.webNavigation, "getAllFrames").mockImplementation(async () =>
    (await frames()).map(({ frameId }) => ({
      frameId,
      parentFrameId: frameId === 0 ? -1 : 0,
      url: "https://example.com",
      errorOccurred: false,
      documentId: String(frameId),
      documentLifecycle: "active" as const,
      frameType: frameId === 0 ? ("outermost_frame" as const) : ("sub_frame" as const),
    })),
  )
  frames.mockResolvedValue([{ frameId: 0 }])
  status.mockReset().mockResolvedValue({ translated: true, failed: false })
})
afterEach(() => {
  vi.restoreAllMocks()
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

it("does not treat an active manager with only failed paragraphs as translation success", async () => {
  send.mockResolvedValue(true)
  status.mockResolvedValue({ translated: false, failed: true })
  await expect(requestPageTranslation(9, true, new AbortController().signal)).rejects.toThrow(
    "Page translation failed",
  )
})

it("counts a translating child frame while the top frame fails and a sibling has no receiver", async () => {
  vi.useFakeTimers()
  frames.mockResolvedValue([{ frameId: 0 }, { frameId: 5 }, { frameId: 8 }])
  send.mockResolvedValue(true)
  const failed = { translated: false, failed: true }
  status
    .mockResolvedValueOnce(failed)
    .mockResolvedValueOnce({ translated: false, failed: false, pending: true })
    .mockRejectedValueOnce(new Error("No receiver"))
    .mockResolvedValueOnce(failed)
    .mockResolvedValueOnce({ translated: true, failed: false })
    .mockRejectedValueOnce(new Error("No receiver"))
  const result = requestPageTranslation(9, true, new AbortController().signal)
  await vi.advanceTimersByTimeAsync(200)
  expect(await result).toBe(true)
  expect(status).toHaveBeenCalledWith("forkGetPageTranslationStatus", undefined, {
    tabId: 9,
    frameId: 5,
  })
  expect(send).not.toHaveBeenCalledWith("tryToSetEnablePageTranslationByTabId", {
    tabId: 9,
    enabled: false,
  })
})

it("keeps waiting while paragraph requests are still in flight", async () => {
  vi.useFakeTimers()
  send.mockResolvedValue(true)
  status.mockResolvedValue({ translated: false, failed: false, pending: true })
  const done = vi.fn<() => void>()
  const promise = requestPageTranslation(9, true, new AbortController().signal).then(done)
  await vi.advanceTimersByTimeAsync(10000)
  expect(done).not.toHaveBeenCalled()
  status.mockResolvedValue({ translated: true, failed: false, pending: false })
  await vi.advanceTimersByTimeAsync(200)
  await promise
  expect(done).toHaveBeenCalledOnce()
})
