import { describe, expect, it, vi } from "vitest"
import { RequestQueue } from "@/utils/request/request-queue"
import { UpstreamCloudDisabledError } from "../disabled-error"

describe("disabled cloud queue isolation", () => {
  it("rejects once without draining a normal sibling or preventing subsequent work", async () => {
    const queue = new RequestQueue({
      rate: 1000,
      capacity: 1,
      timeoutMs: 1000,
      maxRetries: 3,
      baseRetryDelayMs: 1,
    })
    const disabled = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new UpstreamCloudDisabledError())
    const normal = vi.fn<() => Promise<string>>().mockResolvedValue("translated")
    const results = await Promise.allSettled([
      queue.enqueue(disabled, Date.now(), "disabled"),
      queue.enqueue(normal, Date.now(), "normal"),
    ])
    expect(results[0]).toMatchObject({
      status: "rejected",
      reason: { code: "UPSTREAM_CLOUD_DISABLED" },
    })
    expect(results[1]).toEqual({ status: "fulfilled", value: "translated" })
    expect(disabled).toHaveBeenCalledTimes(1)
    expect(normal).toHaveBeenCalledTimes(1)
    await expect(queue.enqueue(normal, Date.now(), "later")).resolves.toBe("translated")
  })
})
