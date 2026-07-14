## ADDED Requirements

### Requirement: fork 代码命名空间隔离

系统 SHALL 把所有净新增的 fork 代码放在 `src/fork/**` 目录下（上游永不创建该目录），使净新增工作与上游产生零文件碰撞。

#### Scenario: 新增 fork 模块不触碰上游文件

- **WHEN** 新增任意 fork 功能代码
- **THEN** 代码文件位于 `src/fork/**`，未修改任何上游源文件

### Requirement: in-place 编辑 allowlist

系统 SHALL 维护一份枚举清单 `scripts/fork-allowlist.json`，列出 fork 唯一允许原地编辑的上游文件；向清单增项 MUST 经过评审。

#### Scenario: allowlist 覆盖已知原地编辑面

- **WHEN** 读取 `scripts/fork-allowlist.json`
- **THEN** 清单包含 `wxt.config.ts`、`src/entrypoints/background/index.ts`、`src/utils/constants/app.ts`、各 `app.tsx` 壳、auth/orpc 客户端、`uninstall-survey.ts` 与 9 个 `src/locales/*.yml`

### Requirement: CI 边界检查

系统 SHALL 提供一个可测试的边界判定函数，对改动文件分类：`src/fork/**` 与 allowlist 内文件放行，其余上游文件判为越界（violation）。CI MUST 在越界时使 sync PR 失败。

#### Scenario: 越界改动被标记

- **WHEN** 改动包含 `src/utils/message.ts`（不在 allowlist）与 `src/fork/x.ts`
- **THEN** 边界判定返回 violations 恰为 `["src/utils/message.ts"]`

#### Scenario: 合规改动通过

- **WHEN** 改动仅包含 `src/fork/**` 文件或 allowlist 内文件
- **THEN** 边界判定返回空 violations，CI 边界检查通过

### Requirement: 三浏览器构建门

系统 SHALL 在合入 `main` 前要求 chrome、edge、firefox 三个目标的 `wxt build` 与 `pnpm run test` 全部通过。

#### Scenario: 构建门作为合并前置

- **WHEN** CI 运行 `pnpm run build`、`build:edge`、`build:firefox` 与 `pnpm run test`
- **THEN** 任一失败即阻止 PR 合入 `main`
