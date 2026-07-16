import type { MigrationFunction } from "./migration-scripts/types"
import type { Config } from "@/types/config/config"
import { configSchema } from "@/types/config/config"
import { i18n } from "@/utils/i18n"
import { CONFIG_SCHEMA_VERSION } from "../constants/config"
import { logger } from "../logger"
import { ConfigVersionTooNewError } from "./errors"

export const LATEST_SCHEMA_VERSION = CONFIG_SCHEMA_VERSION

const MIGRATION_FILENAME_RE = /v(\d+)-to-v(\d+)\.ts$/

/**
 * Loads migration scripts from the "migration-scripts" directory and runs them sequentially to migrate the configuration
 * from the original schema version to the latest schema version.
 * modules : key: ./migration-scripts/v*-to-v*.ts value: migrate function
 * migrationScripts : key: version number value: migrate function
 */
const modules = import.meta.glob<MigrationFunction>(["./migration-scripts/v*-to-v*.ts"], {
  eager: true,
  import: "migrate",
})
const migrationEntries = Object.entries(modules)
  .map(([path, migrate]) => {
    const match = path.match(MIGRATION_FILENAME_RE)
    if (!match) {
      throw new Error(`Invalid migration filename: ${path}`)
    }
    const fromVersion = Number(match[1])
    const toVersion = Number(match[2])
    if (toVersion !== fromVersion + 1) {
      throw new Error(`Invalid migration step: ${path}`)
    }
    return { fromVersion, toVersion, migrate, path }
  })
  .sort((a, b) => a.toVersion - b.toVersion)

const seenTargets = new Set<number>()
migrationEntries.forEach((entry, index) => {
  if (seenTargets.has(entry.toVersion)) {
    throw new Error(`Duplicate migration target version: ${entry.toVersion}`)
  }
  seenTargets.add(entry.toVersion)

  const expectedFromVersion = index + 1
  if (entry.fromVersion !== expectedFromVersion) {
    throw new Error(
      `Discontinuous migration chain at ${entry.path}: expected v${expectedFromVersion} as source`,
    )
  }
})

export const migrationScripts: Record<number, MigrationFunction> = Object.fromEntries(
  migrationEntries.map(({ toVersion, migrate }) => [toVersion, migrate]),
)

logger.log("Loaded migration modules:", migrationScripts)

export async function runMigration(version: number, config: any): Promise<any> {
  const migrationFn = migrationScripts[version]

  if (!migrationFn) {
    throw new Error(`Migration function for version ${version} not found`)
  }

  return migrationFn(config)
}

export async function migrateConfig(
  originalConfig: unknown,
  originalConfigSchemaVersion: number,
): Promise<Config> {
  if (originalConfigSchemaVersion > CONFIG_SCHEMA_VERSION) {
    throw new ConfigVersionTooNewError(i18n.t("options.config.sync.versionTooNew"))
  }

  if (originalConfigSchemaVersion < CONFIG_SCHEMA_VERSION) {
    let currentVersion = originalConfigSchemaVersion
    while (currentVersion < CONFIG_SCHEMA_VERSION) {
      const nextVersion = currentVersion + 1
      originalConfig = await runMigration(nextVersion, originalConfig)
      currentVersion = nextVersion
    }
  }

  const parseResult = configSchema.safeParse(originalConfig)
  if (!parseResult.success) {
    throw new Error(
      `${i18n.t("options.config.sync.validationError")}: ${parseResult.error.message}`,
    )
  }

  return parseResult.data
}
