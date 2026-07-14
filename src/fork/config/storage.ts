import { storage } from "#imports"
import { FORK_CONFIG_SCHEMA_VERSION, FORK_CONFIG_STORAGE_KEY } from "./constants"
import { migrateForkConfig } from "./migration"
import { DEFAULT_FORK_CONFIG, type ForkConfig } from "./schema"

// 读取 fork 配置，缺失或旧版本走独立迁移
export async function loadForkConfig(): Promise<ForkConfig> {
  const stored = await storage.getItem<ForkConfig>(`local:${FORK_CONFIG_STORAGE_KEY}`)
  if (!stored) return DEFAULT_FORK_CONFIG
  if (stored.schemaVersion === FORK_CONFIG_SCHEMA_VERSION) return stored
  const migrated = migrateForkConfig(stored, stored.schemaVersion ?? 0)
  await storage.setItem<ForkConfig>(`local:${FORK_CONFIG_STORAGE_KEY}`, migrated)
  return migrated
}
