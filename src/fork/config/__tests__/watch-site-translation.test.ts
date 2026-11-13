// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { watchSiteTranslation } from "../watch-site-translation"

describe("site translation cancellation", () => {
  it("stops active or pending work in every frame on site disable and releases the subscription", async () => {
    const stop = vi.fn<() => void>()
    const unwatch = watchSiteTranslation({ stop })
    const config = structuredClone(DEFAULT_CONFIG)
    config.siteControl = { mode: "whitelist", whitelistPatterns: [], blacklistPatterns: [] }
    await storage.setItem("local:config", config)
    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce())
    unwatch()
    await storage.setItem("local:config", DEFAULT_CONFIG)
    expect(stop).toHaveBeenCalledOnce()
  })
})
