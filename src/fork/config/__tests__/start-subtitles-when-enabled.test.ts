import type { FeatureConfigSnapshot } from "../types"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrateFeatureConfig } from "../migration"
import { startSubtitlesWhenEnabled } from "../start-subtitles-when-enabled"

const mock = vi.hoisted(() => ({
  listener: undefined as undefined | ((pair: FeatureConfigSnapshot) => Promise<void>),
  unwatch: vi.fn<() => void>(),
}))
vi.mock("../storage", () => ({
  subscribeFeatureConfig: (listener: typeof mock.listener) => {
    mock.listener = listener
    return mock.unwatch
  },
}))

describe("subtitle enable lifecycle", () => {
  it("waits while disabled, starts once after enabling, and stops listening on invalidation", async () => {
    const pair = {
      ...migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined),
      revision: "test",
    }
    pair.mainConfig.videoSubtitles.enabled = false
    const start = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const dispose = startSubtitlesWhenEnabled(start)
    await mock.listener!(pair)
    expect(start).not.toHaveBeenCalled()
    pair.mainConfig.videoSubtitles.enabled = true
    await Promise.all([mock.listener!(pair), mock.listener!(pair)])
    expect(start).toHaveBeenCalledOnce()
    dispose()
    await mock.listener!(pair)
    expect(start).toHaveBeenCalledOnce()
    expect(mock.unwatch).toHaveBeenCalledOnce()
  })
})
