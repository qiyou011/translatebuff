import type { Config } from "@/types/config/config"
import { storage } from "#imports"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { migratePair } from "./policy"

export const PAGE_DEFAULTS_MIGRATION_KEY = "local:fork:page-translation-v140-defaults" as const

export async function initializePageTranslationDefaults(): Promise<void> {
  if (await storage.getItem<boolean>(PAGE_DEFAULTS_MIGRATION_KEY)) return
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  if (!config) throw new Error("Page defaults require initialized config")
  const current = config.pageTranslation.batchQueueConfig
  const migrated = migratePair(current)
  if (migrated !== current) {
    await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, {
      ...config,
      pageTranslation: { ...config.pageTranslation, batchQueueConfig: migrated },
    })
  }
  await storage.setItem(PAGE_DEFAULTS_MIGRATION_KEY, true)
}
