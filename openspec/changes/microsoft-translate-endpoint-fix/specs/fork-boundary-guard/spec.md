## MODIFIED Requirements

### Requirement: 三浏览器构建门

系统 SHALL 在合入 `main` 前要求 chrome、edge、firefox 三个目标的 `wxt build` 与 `pnpm run test` 全部通过。

CI 运行 `pnpm run test` 时 MUST 设置 `SKIP_FREE_API: true`，使打真实外部翻译服务的用例（`free-api.test.ts` 及后续沿用同一 `describe.skip` 守卫的 fork 实机测试）跳过，避免外部端点不可用或限流导致构建门与本仓改动无关地变红。该写法与 `release.yml` 一致；MUST NOT 改用 `--exclude` glob——glob 只挡住单个文件名，日后新增的 fork 实机测试仍会真打网络。

本地开发者仍可不设该变量以按需跑通实机用例。

#### Scenario: 构建门作为合并前置

- **WHEN** CI 运行 `pnpm run build`、`build:edge`、`build:firefox` 与 `pnpm run test`
- **THEN** 任一失败即阻止 PR 合入 `main`

#### Scenario: 实机翻译用例在 CI 跳过

- **GIVEN** `fork-guard.yml` 的测试步骤设置了 `SKIP_FREE_API: true`
- **WHEN** CI 运行 `pnpm run test`
- **THEN** `free-api.test.ts` 的实机用例被跳过，外部端点 404 或限流不会使构建门变红

#### Scenario: 本地仍可跑实机用例

- **WHEN** 开发者在本地不设 `SKIP_FREE_API` 直接运行 `pnpm run test`
- **THEN** 实机用例照常执行，可用于人工验收前的端点连通性确认
