import { beforeEach, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"

const initialized = vi.hoisted(() => vi.fn<() => Promise<{ isFreshInstall: boolean }>>())
vi.mock("@/utils/config/init", () => ({ initializeConfig: initialized }))
beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  await storage.clear("local")
})

it("fresh-install and config callers share the entire migration promise", async () => {
  initialized.mockImplementation(async () => {
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, structuredClone(DEFAULT_CONFIG))
    return { isFreshInstall: true }
  })
  const { ensureInitializedConfig, isFreshInstalledConfig } =
    await import("@/entrypoints/background/config")
  const [config, fresh] = await Promise.all([ensureInitializedConfig(), isFreshInstalledConfig()])
  expect(initialized).toHaveBeenCalledTimes(1)
  expect(fresh).toBe(true)
  expect(config?.pageTranslation.batchQueueConfig).toEqual({
    maxItemsPerBatch: 16,
    maxCharactersPerBatch: 4000,
  })
})

it("a failed initialization can be retried rather than memoizing rejection forever", async () => {
  initialized
    .mockRejectedValueOnce(new Error("storage unavailable"))
    .mockImplementationOnce(async () => {
      await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, structuredClone(DEFAULT_CONFIG))
      return { isFreshInstall: true }
    })
  const { ensureInitializedConfig } = await import("@/entrypoints/background/config")
  await expect(ensureInitializedConfig()).rejects.toThrow("storage unavailable")
  expect((await ensureInitializedConfig())?.pageTranslation.batchQueueConfig.maxItemsPerBatch).toBe(
    16,
  )
  expect(initialized).toHaveBeenCalledTimes(2)
})
