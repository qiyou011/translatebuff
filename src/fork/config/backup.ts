import type { FeatureConfigSnapshot } from "./types"
import type { Config } from "@/types/config/config"
import { sendForkMessage } from "@/fork/message"
import { isRenyimiaoInstance } from "@/fork/providers/renyimiao-identity"
import { configSchema } from "@/types/config/config"
import { addBackup } from "@/utils/backup/storage"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { CONFIG_SCHEMA_VERSION, buildFreshDefaultConfig } from "@/utils/constants/config"
import { migrateFeatureConfig } from "./migration"
import { forkConfigSchema } from "./schema"
import { readFeatureConfig } from "./storage"

export function createFeatureBackup(pair: FeatureConfigSnapshot) {
  const config = structuredClone(pair.mainConfig)
  config.providersConfig = config.providersConfig.map((provider) =>
    isRenyimiaoInstance(provider) && "apiKey" in provider ? { ...provider, apiKey: "" } : provider,
  )
  const {
    schemaVersion,
    featureLanguages,
    inputTranslation,
    translationTextColor,
    translationPresetColors,
  } = pair.forkConfig
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    config,
    forkConfig: {
      schemaVersion,
      featureLanguages,
      inputTranslation,
      translationTextColor,
      translationPresetColors,
    },
  }
}

export async function readFeatureBackup() {
  return createFeatureBackup(await readFeatureConfig())
}

export function prepareImportedFeatureConfig(
  main: Config,
  rawFork: unknown,
  current: FeatureConfigSnapshot,
) {
  if (rawFork && typeof rawFork === "object" && "translationTextColor" in rawFork) {
    forkConfigSchema.shape.translationTextColor.parse(rawFork.translationTextColor)
  }
  if (rawFork && typeof rawFork === "object" && "translationPresetColors" in rawFork) {
    forkConfigSchema.shape.translationPresetColors.parse(rawFork.translationPresetColors)
  }
  const pair = migrateFeatureConfig(configSchema.parse(main), rawFork)
  pair.forkConfig.membership = current.forkConfig.membership
  pair.forkConfig.revision = current.forkConfig.revision + 1
  pair.mainConfig.providersConfig = pair.mainConfig.providersConfig.map((provider) => {
    if (!isRenyimiaoInstance(provider) || !("apiKey" in provider)) return provider
    const active =
      current.mainConfig.providersConfig.find((p) => p.id === provider.id) ??
      current.mainConfig.providersConfig.find(isRenyimiaoInstance)
    return { ...provider, apiKey: active && "apiKey" in active ? active.apiKey : "" }
  })
  return pair
}

export async function importFeatureConfig(
  mainConfig: Config,
  forkConfig?: unknown,
  applyRelated?: () => Promise<void>,
) {
  const before = await readFeatureConfig()
  // Validate before creating the safety backup or writing any imported data.
  prepareImportedFeatureConfig(mainConfig, forkConfig, before)
  const backup = createFeatureBackup(before)
  await addBackup(backup.config, EXTENSION_VERSION, backup.forkConfig)
  const result = await sendForkMessage("forkReplaceFeatureConfig", {
    expectedRevision: before.revision,
    mainConfig,
    forkConfig,
  })
  if (!result.ok) throw new Error("Configuration changed during import; please retry")
  try {
    await applyRelated?.()
  } catch (error) {
    const restored = await sendForkMessage("forkReplaceFeatureConfig", {
      expectedRevision: result.snapshot.revision,
      mainConfig: before.mainConfig,
      forkConfig: before.forkConfig,
    })
    if (!restored.ok)
      throw new Error(
        "Import failed and newer settings prevented rollback; the pre-import backup is available",
        { cause: error },
      )
    throw error
  }
}

export function resetFeatureConfig() {
  return importFeatureConfig(buildFreshDefaultConfig())
}
