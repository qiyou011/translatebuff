import type { FeatureConfigSnapshot } from "../types"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
const { read, watchers } = vi.hoisted(() => ({
  read: vi.fn<() => Promise<FeatureConfigSnapshot>>(),
  watchers: new Map<string, () => void>(),
}))
vi.mock("../../message", () => ({ sendForkMessage: read }))
import { subscribeFeatureConfig } from "../storage"

describe("feature config subscriptions", () => {
  beforeEach(() => {
    read.mockReset()
    watchers.clear()
    vi.spyOn(storage, "watch").mockImplementation((key, callback) => {
      watchers.set(key, () => callback(null, null))
      return () => {
        watchers.delete(key)
      }
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  it("recovers when the background receiver becomes available without a storage event", async () => {
    vi.useFakeTimers()
    read.mockRejectedValueOnce(new Error("Receiving end does not exist"))
    read.mockResolvedValue({ revision: "ready" } as FeatureConfigSnapshot)
    const listener = vi.fn<(snapshot: FeatureConfigSnapshot) => void>()
    const stop = subscribeFeatureConfig(listener)
    await vi.advanceTimersByTimeAsync(500)
    expect(listener).toHaveBeenCalledWith({ revision: "ready" })
    stop()
  })

  it("bounds retries and cancels them after unmount", async () => {
    vi.useFakeTimers()
    read.mockRejectedValue(new Error("Receiving end does not exist"))
    const stop = subscribeFeatureConfig(vi.fn())
    await vi.advanceTimersByTimeAsync(10000)
    expect(read).toHaveBeenCalledTimes(4)
    stop()
    read.mockClear()
    const stopNext = subscribeFeatureConfig(vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    stopNext()
    await vi.advanceTimersByTimeAsync(10000)
    expect(read).toHaveBeenCalledTimes(1)
  })
  it("discards a delayed old read when either storage key changes", async () => {
    let release!: (value: FeatureConfigSnapshot) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    read.mockResolvedValue({ revision: "new" } as FeatureConfigSnapshot)
    const listener = vi.fn<(snapshot: FeatureConfigSnapshot) => void>()
    const stop = subscribeFeatureConfig(listener)
    watchers.get("local:forkConfig")!()
    watchers.get("local:config")!()
    release({ revision: "old" } as FeatureConfigSnapshot)
    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce())
    expect(listener).toHaveBeenCalledWith({ revision: "new" })
    stop()
    expect(watchers.size).toBe(0)
  })

  it("does not publish after unmount", async () => {
    let release!: (value: FeatureConfigSnapshot) => void
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    const listener = vi.fn<(snapshot: FeatureConfigSnapshot) => void>()
    const stop = subscribeFeatureConfig(listener)
    stop()
    release({ revision: "late" } as FeatureConfigSnapshot)
    await Promise.resolve()
    expect(listener).not.toHaveBeenCalled()
  })
})
