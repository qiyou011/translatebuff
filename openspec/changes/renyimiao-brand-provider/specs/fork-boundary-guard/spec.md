## MODIFIED Requirements

### Requirement: CI 边界检查

系统 SHALL 提供一个可测试的边界判定函数，对改动文件分类：`src/fork/**` 与 allowlist 内文件放行，其余上游文件判为越界（violation）。CI MUST 在越界时使 sync PR 失败。此外，判定函数 MUST 放行 fork 自有/自改的根级 meta 文件——在既有豁免 `FORK.md`、`.env.production`、`.env` 的基础上，同样豁免 `FORK_GUIDE.md`、`CLAUDE.md`（fork 净新增文档）与 `.gitignore`（fork 为忽略自有工具文件而修改），使这些非上游引擎文件不被误判越界。

#### Scenario: 越界改动被标记

- **WHEN** 改动包含 `src/utils/message.ts`（不在 allowlist）与 `src/fork/x.ts`
- **THEN** 边界判定返回 violations 恰为 `["src/utils/message.ts"]`

#### Scenario: 合规改动通过

- **WHEN** 改动仅包含 `src/fork/**` 文件或 allowlist 内文件
- **THEN** 边界判定返回空 violations，CI 边界检查通过

#### Scenario: fork 自有根文档与根配置被放行

- **GIVEN** `[数据层]` `FORK_GUIDE.md`、`CLAUDE.md` 为 fork 净新增根文档，`.gitignore` 为 fork 自改根配置
- **WHEN** 改动包含 `FORK_GUIDE.md`、`CLAUDE.md`、`.gitignore`
- **THEN** 边界判定 MUST 将三者视为合规、不计入 violations（与既有 `FORK.md`、`.env.production` 豁免一致）
