import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { initializePageTranslationDefaults, PAGE_DEFAULTS_MIGRATION_KEY } from "../migration"

describe("page defaults migration", () => {
  beforeEach(async () => {
    await storage.clear("local")
  })
  it.each([
    [4, 1000, 16, 4000],
    [4, 2000, 4, 2000],
    [8, 1000, 8, 1000],
  ])("only changes the exact pair %s/%s", async (items, chars, wantItems, wantChars) => {
    const config = structuredClone(DEFAULT_CONFIG)
    config.pageTranslation.batchQueueConfig = {
      maxItemsPerBatch: items,
      maxCharactersPerBatch: chars,
    }
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, config)
    await initializePageTranslationDefaults()
    const actual = await storage.getItem<typeof config>(`local:${CONFIG_STORAGE_KEY}`)
    expect(actual?.pageTranslation.batchQueueConfig).toEqual({
      maxItemsPerBatch: wantItems,
      maxCharactersPerBatch: wantChars,
    })
    expect(actual?.videoSubtitles).toEqual(config.videoSubtitles)
    expect(actual?.providersConfig).toEqual(config.providersConfig)
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, config)
    await initializePageTranslationDefaults()
    expect(await storage.getItem(`local:${CONFIG_STORAGE_KEY}`)).toEqual(config)
  })
  it("does not mark failure as success and can retry", async () => {
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, structuredClone(DEFAULT_CONFIG))
    const original = storage.setItem.bind(storage)
    const spy = vi.spyOn(storage, "setItem").mockRejectedValueOnce(new Error("write failed"))
    await expect(initializePageTranslationDefaults()).rejects.toThrow("write failed")
    expect(await storage.getItem(PAGE_DEFAULTS_MIGRATION_KEY)).toBeNull()
    spy.mockImplementation(original)
    await initializePageTranslationDefaults()
    expect(await storage.getItem(PAGE_DEFAULTS_MIGRATION_KEY)).toBe(true)
    spy.mockRestore()
  })
  it("does not mark a missing upstream config as migrated", async () => {
    await expect(initializePageTranslationDefaults()).rejects.toThrow(Error)
    expect(await storage.getItem(PAGE_DEFAULTS_MIGRATION_KEY)).toBeNull()
  })
})
