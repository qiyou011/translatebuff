import { FORK_CONFIG_SCHEMA_VERSION } from "./constants"
import { DEFAULT_FORK_CONFIG, forkConfigSchema, type ForkConfig } from "./schema"

// fork 自有迁移链，独立编号，绝不与上游 CONFIG_SCHEMA_VERSION 交叉
export function migrateForkConfig(raw: unknown, _fromVersion: number): ForkConfig {
  const base = forkConfigSchema.safeParse(raw)
  const merged = base.success ? base.data : DEFAULT_FORK_CONFIG
  return { ...merged, schemaVersion: FORK_CONFIG_SCHEMA_VERSION }
}
