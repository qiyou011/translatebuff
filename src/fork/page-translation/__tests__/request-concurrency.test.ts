import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RequestQueue } from "@/utils/request/request-queue"

function makeQueue(maxConcurrent?: number, timeoutMs = 10000) {
  return new RequestQueue({
    rate: 100,
    capacity: 100,
    timeoutMs,
    maxRetries: 0,
    baseRetryDelayMs: 1,
    maxConcurrent,
  })
}

describe("real request concurrency", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("classifies an authentication failure before dispatching another waiting request", async () => {
    const queue = makeQueue(1)
    let reject!: (error: Error) => void
    const started: string[] = []
    const first = queue.enqueue(
      () =>
        new Promise<void>((_resolve, no) => {
          reject = no
        }),
      Date.now(),
      "first",
    )
    const second = queue.enqueue(
      async () => {
        started.push("second")
      },
      Date.now(),
      "second",
    )
    const results = Promise.allSettled([first, second])
    reject(Object.assign(new Error("Unauthorized"), { statusCode: 401 }))
    await vi.advanceTimersByTimeAsync(0)
    await results
    expect(started).toEqual([])
  })

  it("holds the third request until one of two real calls finishes", async () => {
    const queue = makeQueue(2)
    const started: number[] = []
    const finish: (() => void)[] = []
    const jobs = [0, 1, 2].map((id) =>
      queue.enqueue(
        () => {
          started.push(id)
          return new Promise<void>((resolve) => {
            finish[id] = resolve
          })
        },
        Date.now(),
        String(id),
      ),
    )
    expect(started).toEqual([0, 1])
    expect(queue.nextDispatchEtaMs()).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(100)
    expect(started).toEqual([0, 1])
    finish[0]!()
    await vi.advanceTimersByTimeAsync(0)
    expect(started).toEqual([0, 1, 2])
    finish[1]!()
    finish[2]!()
    await Promise.all(jobs)
  })

  it.each(["timeout", "cancel"])("does not free a real slot early on %s", async (reason) => {
    const queue = makeQueue(1, 50)
    let finish!: () => void
    const started: string[] = []
    const first = queue.enqueue(
      () => {
        started.push("first")
        return new Promise<void>((resolve) => {
          finish = resolve
        })
      },
      Date.now(),
      "first",
      ["1:page"],
    )
    const rejected = first.catch(() => "rejected")
    const second = queue.enqueue(
      async () => {
        started.push("second")
      },
      Date.now(),
      "second",
    )
    if (reason === "cancel") queue.cancelByScope("1:page")
    await vi.advanceTimersByTimeAsync(60)
    expect(await rejected).toBe("rejected")
    expect(started).toEqual(["first"])
    finish()
    await vi.advanceTimersByTimeAsync(0)
    await second
    expect(started).toEqual(["first", "second"])
  })

  it("leaves callers without a limit unconstrained", async () => {
    const queue = makeQueue()
    let calls = 0
    const jobs = Array.from({ length: 20 }, (_, id) =>
      queue.enqueue(
        async () => {
          calls++
        },
        Date.now(),
        String(id),
      ),
    )
    expect(calls).toBe(20)
    await Promise.all(jobs)
  })

  it.each([0, -1, 1.5, NaN])("rejects invalid maxConcurrent %s", (maxConcurrent) => {
    expect(() => makeQueue(maxConcurrent)).toThrow(Error)
    expect(() => makeQueue(2).setQueueOptions({ maxConcurrent })).toThrow(Error)
  })
})
