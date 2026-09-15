import type { Config } from "@/types/config/config"
import type { InitializeConfigResult } from "@/utils/config/init"
import { storage } from "#imports"
import { initializePageTranslationDefaults } from "@/fork/page-translation/migration"
import { initializeConfig } from "@/utils/config/init"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"

let configPromise: Promise<InitializeConfigResult> | null = null

function initializeConfigWithPageDefaults() {
  return initializeConfig()
    .then(async (result) => {
      await initializePageTranslationDefaults()
      return result
    })
    .catch((error) => {
      configPromise = null
      throw error
    })
}

// To avoid background script initialize config simultaneously and avoid race condition
export async function ensureInitializedConfig() {
  if (!configPromise) {
    configPromise = initializeConfigWithPageDefaults()
  }
  await configPromise
  return storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
}

/**
 * Whether the config was created from defaults in this run, rather than loaded from storage.
 * Shares the memoized initialization above, so it never triggers a second init.
 */
export async function isFreshInstalledConfig() {
  if (!configPromise) {
    configPromise = initializeConfigWithPageDefaults()
  }
  return (await configPromise).isFreshInstall
}
