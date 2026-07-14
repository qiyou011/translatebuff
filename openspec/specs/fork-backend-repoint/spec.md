# fork-backend-repoint Specification

## Purpose

TBD - created by archiving change fork-foundation. Update Purpose after archive.

## Requirements

### Requirement: 后端环境指向（B3）

系统 SHALL 通过 force-add 的 `.env.production` 覆盖 `WXT_API_URL`、`WXT_WEBSITE_URL`、`WXT_OFFICIAL_SITE_ORIGINS`、`WXT_AUTH_COOKIE_DOMAINS` 为 fork 后端，而不编辑 `src/env/shared.ts`。

#### Scenario: 生产构建指向 fork 后端

- **WHEN** 在无残留 `WXT_*` 环境变量的干净环境下、存在 `.env.production` 时执行 `pnpm run build`
- **THEN** 构建成功，运行时环境的 4 个 URL/origin/domain 均为 fork 值

#### Scenario: 满足生产环境校验

- **WHEN** 生产构建校验 `WXT_GOOGLE_CLIENT_ID`、`WXT_POSTHOG_HOST`、`WXT_POSTHOG_API_KEY` 等 required 项
- **THEN** `.env.production` 提供了这些必填项（v1 阶段以占位或 fork 自有值满足），构建守卫不抛错

### Requirement: 构建产物无上游域名断言

系统 SHALL 提供一个可测试的扫描函数与 CI 步骤，检查构建产物文本中不含上游域名（`api.readfrog.app`、`www.readfrog.app`）；命中即失败，以防 shell 残留 `WXT_*` 静默打包旧域名。

#### Scenario: 命中上游域名判失败

- **WHEN** 产物文本包含 `api.readfrog.app`
- **THEN** `findUpstreamDomainHits(text, ["api.readfrog.app"])` 返回 `["api.readfrog.app"]`，CI 断言失败

#### Scenario: 仅含 fork 域名通过

- **WHEN** 产物文本仅含 fork 域名（如 `api.translatebuff.com`）
- **THEN** 扫描返回空数组，CI 断言通过

### Requirement: v1 保留 better-auth

系统 SHALL 在 v1 保留上游 better-auth 认证客户端不做代码替换，仅通过环境指向到 fork 后端；后端负责实现兼容的认证契约。

#### Scenario: 不替换认证客户端

- **WHEN** 检视 `src/utils/auth/*` 与 `src/utils/orpc/*`
- **THEN** 这些客户端保持上游原样（未被 fork 重导出桩替换），认证经由 `env.WXT_API_URL` 指向 fork 后端
