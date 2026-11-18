// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { watchSiteTranslation } from "../watch-site-translation"

describe("site translation cancellation", () => {
  it("stops active or pending work in every frame on site disable and releases the subscription", async () => {
    const stop = vi.fn<() => void>()
    const unwatch = watchSiteTranslation({ stop, start: vi.fn<() => void>(), isActive: true })
    const config = structuredClone(DEFAULT_CONFIG)
    config.siteControl = { mode: "whitelist", whitelistPatterns: [], blacklistPatterns: [] }
    await storage.setItem("local:config", config)
    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce())
    unwatch()
    await storage.setItem("local:config", DEFAULT_CONFIG)
    expect(stop).toHaveBeenCalledOnce()
  })
})

it.each(["provider", "mode", "language"])(
  "invalidates the old session before restarting on %s changes",
  async (field) => {
    const before = structuredClone(DEFAULT_CONFIG)
    await storage.setItem("local:config", before)
    const stop = vi.fn<() => void>()
    const start = vi.fn<() => void>()
    const unwatch = watchSiteTranslation({ stop, start, isActive: true })
    const after = structuredClone(before)
    if (field === "provider")
      after.pageTranslation.providerId =
        before.pageTranslation.providerId === "google-translate-default"
          ? "microsoft-translate-default"
          : "google-translate-default"
    if (field === "mode") after.pageTranslation.mode = "translationOnly"
    if (field === "language") after.language.targetCode = "jpn"
    await storage.setItem("local:config", after)
    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce())
    expect(start).toHaveBeenCalledOnce()
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0]!)
    unwatch()
  },
)

it("keeps the active page session when an unrelated provider changes", async () => {
  const before = structuredClone(DEFAULT_CONFIG)
  await storage.setItem("local:config", before)
  const stop = vi.fn<() => void>()
  const unwatch = watchSiteTranslation({ stop, start: vi.fn<() => void>(), isActive: true })
  const after = structuredClone(before)
  after.providersConfig.find((p) => p.id !== after.pageTranslation.providerId)!.name =
    "Unrelated provider"
  await storage.setItem("local:config", after)
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(stop).not.toHaveBeenCalled()
  unwatch()
})
