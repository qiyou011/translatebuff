## ADDED Requirements

### Requirement: fork 配置隔离存储（B2）

系统 SHALL 让 fork 专属设置使用独立的 storage key 与独立 zod schema，绝不进入上游 `configSchema`、`DEFAULT_CONFIG` 或上游迁移脚本。

#### Scenario: fork 配置独立于上游 schema

- **WHEN** 读取 fork 配置常量
- **THEN** 存在独立的 `FORK_CONFIG_STORAGE_KEY`（区别于上游 `CONFIG_STORAGE_KEY`）与独立的 `forkConfigSchema`，上游 `src/types/config/*` 与 `migration-scripts/*` 未被改动

#### Scenario: 默认值满足 fork schema

- **WHEN** 用 `forkConfigSchema` 解析 `DEFAULT_FORK_CONFIG`
- **THEN** 解析成功、不抛错

### Requirement: fork 独立迁移链

系统 SHALL 为 fork 配置维护独立的 `FORK_CONFIG_SCHEMA_VERSION` 与迁移函数，与上游 `CONFIG_SCHEMA_VERSION` 完全解耦，使上游迁移脚本对 fork 永远是 take-theirs、零冲突。

#### Scenario: 旧版本 fork 配置被迁移

- **WHEN** 用 `migrateForkConfig({}, 0)` 迁移一个 v0 空配置
- **THEN** 返回结果可被 `forkConfigSchema` 解析通过，且 `schemaVersion` 为当前 `FORK_CONFIG_SCHEMA_VERSION`

#### Scenario: 读取时按需迁移并回写

- **WHEN** 存储中的 fork 配置 `schemaVersion` 低于当前版本
- **THEN** `loadForkConfig()` 迁移后回写存储并返回当前版本配置
