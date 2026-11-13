import type { Config } from "./config/config"

export interface ConfigBackup {
  schemaVersion: number
  config: Config
  /** Optional product-owned settings; older backups omit this field. */
  forkConfig?: unknown
}

export interface ConfigBackupMetadata extends Record<string, unknown> {
  createdAt: number
  extensionVersion: string
}

export interface ConfigBackupWithMetadata extends ConfigBackup {
  metadata: ConfigBackupMetadata
  id: string
}
