import { storage } from "#imports"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { FORK_CONFIG_SCHEMA_VERSION, FORK_CONFIG_STORAGE_KEY } from "./constants"
import { migrateForkConfig } from "./migration"
import { DEFAULT_FORK_CONFIG, forkConfigSchema, type ForkConfig } from "./schema"

// 读取 fork 配置，缺失或旧版本走独立迁移。写入复用全库统一的 storageAdapter（自带 schema 校验）
export async function loadForkConfig(): Promise<ForkConfig> {
  // 需读原始值判定 schemaVersion 以决定是否迁移，故此处直接取（与上游 config/init.ts 同理）
  const stored = await storage.getItem<ForkConfig>(`local:${FORK_CONFIG_STORAGE_KEY}`)
  if (!stored) return DEFAULT_FORK_CONFIG
  if (stored.schemaVersion === FORK_CONFIG_SCHEMA_VERSION) {
    const parsed = forkConfigSchema.safeParse(stored)
    return parsed.success ? parsed.data : DEFAULT_FORK_CONFIG
  }
  const migrated = migrateForkConfig(stored)
  await storageAdapter.set(FORK_CONFIG_STORAGE_KEY, migrated, forkConfigSchema)
  return migrated
}
