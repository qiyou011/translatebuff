import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { storage } from "#imports"
import {
  clearHostedAiStatusCache,
  setupHostedAiStatusHandler,
} from "@/entrypoints/background/hosted-ai-status"
import { setupNotebasePendingSaveProcessor } from "@/entrypoints/background/notebase-pending-save"

const handlers = vi.hoisted(() => new Map<string, () => Promise<unknown>>())
vi.mock("@/utils/message", () => ({
  onMessage: (name: string, handler: () => Promise<unknown>) => {
    handlers.set(name, handler)
  },
  sendMessage: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}))

beforeEach(() => {
  fakeBrowser.reset()
  handlers.clear()
  vi.restoreAllMocks()
})

describe("disabled background triggers", () => {
  it("answers null even with a previously available hosted cache", async () => {
    await storage.setItem("session:hostedAiStatus", {
      status: { available: true },
      cachedAt: Date.now(),
    })
    setupHostedAiStatusHandler()
    const handler = handlers.get("getHostedAiStatus")
    if (!handler) throw new Error("Missing status handler")
    expect(await handler()).toBeNull()
    await clearHostedAiStatusCache()
    expect(await handler()).toBeNull()
  })

  it("does not start or subscribe a pending-save processor and retains storage", async () => {
    await fakeBrowser.storage.local.set({
      notebasePendingSave: { content: "retained", expiresAt: 0 },
    })
    const before = await fakeBrowser.storage.local.get(null)
    const waitUntilReady = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const subscribe = vi
      .spyOn(fakeBrowser.cookies.onChanged, "addListener")
      .mockImplementation(() => {})
    setupNotebasePendingSaveProcessor(waitUntilReady)
    await Promise.resolve()
    expect(waitUntilReady).not.toHaveBeenCalled()
    expect(subscribe).not.toHaveBeenCalled()
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before)
  })
})
