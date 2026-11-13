import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { createFeatureConfigStore } from "@/fork/background/initialize-feature-config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { commitMainConfigUpdate } from "../main-config-bridge"

let service: ReturnType<typeof createFeatureConfigStore>
vi.mock("@/fork/message", () => ({
  sendForkMessage: (name: string, data: never) => {
    if (name === "forkReadFeatureConfig") return service.read()
    if (name === "forkReplaceFeatureConfig") return service.replace(data)
    throw new Error(name)
  },
}))

describe("existing settings coordination", () => {
  beforeEach(async () => {
    await storage.clear("local")
    service = createFeatureConfigStore(async () => {
      await storage.setItem("local:config", structuredClone(DEFAULT_CONFIG))
    })
  })

  it("reapplies field updaters after concurrent settings writes without losing independent features", async () => {
    await service.read()
    await Promise.all([
      commitMainConfigUpdate((current) => ({ ...current, uiLanguage: "ja" })),
      commitMainConfigUpdate((current) => ({
        ...current,
        language: { ...current.language, targetCode: "fra" },
      })),
    ])
    const pair = await service.read()
    expect(pair.mainConfig.uiLanguage).toBe("ja")
    expect(pair.mainConfig.language.targetCode).toBe("fra")
    const beforeSelection = pair.forkConfig.featureLanguages.selection
    const patched = await service.patch({
      expectedRevision: pair.revision,
      fork: { featureLanguages: { subtitles: { targetCode: "deu" } } },
    })
    expect(patched.snapshot.forkConfig.featureLanguages.selection).toEqual(beforeSelection)
    expect(patched.snapshot.mainConfig.language.targetCode).toBe("fra")
  })
})
