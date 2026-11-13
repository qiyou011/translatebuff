import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  createFeatureConfigStore,
  FEATURE_CONFIG_JOURNAL_KEY,
} from "../../background/initialize-feature-config"

describe("background feature configuration store", () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await storage.clear("local")
  })

  function store() {
    return createFeatureConfigStore(async () => {
      if (!(await storage.getItem("local:config"))) {
        await storage.setItem("local:config", structuredClone(DEFAULT_CONFIG))
      }
    })
  }

  it("waits for upstream initialization before publishing a complete snapshot", async () => {
    let release!: () => void
    const initialized = new Promise<void>((resolve) => {
      release = resolve
    })
    const service = createFeatureConfigStore(async () => {
      await initialized
      await storage.setItem("local:config", structuredClone(DEFAULT_CONFIG))
    })
    let published = false
    const pending = service.read().then((value) => {
      published = true
      return value
    })
    await Promise.resolve()
    expect(published).toBe(false)
    release()
    const snapshot = await pending
    expect(snapshot.forkConfig.inputTranslation.triggerCount).toBe(2)
    expect(snapshot.mainConfig.inputTranslation.toLang).toBe(
      snapshot.mainConfig.language.targetCode,
    )
    expect(await storage.getItem(FEATURE_CONFIG_JOURNAL_KEY)).toBeNull()
  })

  it("recovers an interrupted commit on background restart before returning ready", async () => {
    const service = store()
    const first = await service.read()
    const original = storage.setItems.bind(storage)
    const write = vi
      .spyOn(storage, "setItems")
      .mockRejectedValueOnce(new Error("interrupted write"))
    await expect(
      service.patch({
        expectedRevision: first.revision,
        fork: { inputTranslation: { triggerCount: 4 } },
      }),
    ).rejects.toThrow("interrupted write")
    expect(await storage.getItem(FEATURE_CONFIG_JOURNAL_KEY)).not.toBeNull()
    write.mockImplementation(original)
    const recovered = await store().read()
    expect(recovered.forkConfig.inputTranslation.triggerCount).toBe(4)
    expect(await storage.getItem(FEATURE_CONFIG_JOURNAL_KEY)).toBeNull()
  })

  it("serializes concurrent patches and rejects stale revisions without losing choices", async () => {
    const service = store()
    const initial = await service.read()
    const results = await Promise.all([
      service.patch({
        expectedRevision: initial.revision,
        fork: { inputTranslation: { triggerCount: 5 } },
      }),
      service.patch({
        expectedRevision: initial.revision,
        fork: { translationTextColor: "#abcdef" },
      }),
    ])
    expect(results.map((result) => result.ok)).toEqual([true, false])
    const current = await service.read()
    expect(current.forkConfig.inputTranslation.triggerCount).toBe(5)
    expect(current.forkConfig.translationTextColor).toBeNull()
    await service.patch({
      expectedRevision: current.revision,
      fork: { translationTextColor: "#abcdef" },
    })
    expect((await store().read()).forkConfig).toMatchObject({
      inputTranslation: { triggerCount: 5 },
      translationTextColor: "#abcdef",
    })
  })

  it("rejects a stale snapshot after a write through an existing main config entry", async () => {
    const service = store()
    const initial = await service.read()
    await storage.setItem("local:config", {
      ...initial.mainConfig,
      language: { ...initial.mainConfig.language, targetCode: "fra" },
    })
    const result = await service.patch({
      expectedRevision: initial.revision,
      fork: { inputTranslation: { triggerCount: 3 } },
    })
    expect(result.ok).toBe(false)
    expect(result.snapshot.mainConfig.language.targetCode).toBe("fra")
    expect(result.snapshot.forkConfig.inputTranslation.triggerCount).toBe(2)
  })

  it("rejects invalid values before any writes and continues processing afterwards", async () => {
    const service = store()
    const initial = await service.read()
    await expect(
      service.patch({
        expectedRevision: initial.revision,
        fork: { inputTranslation: { triggerCount: 8 } },
      }),
    ).rejects.toThrow(/Too big/)
    expect(await service.read()).toEqual(initial)
    expect(await storage.getItem(FEATURE_CONFIG_JOURNAL_KEY)).toBeNull()
    expect(
      (
        await service.patch({
          expectedRevision: initial.revision,
          fork: { inputTranslation: { triggerCount: 3 } },
        })
      ).ok,
    ).toBe(true)
  })
})
