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

### Requirement: 上游认证客户端本地禁用适配

系统 SHALL 在 fork 构建中替换上游界面和后台认证客户端的运行时实现，保留消费方需要的导出和会话契约。会话读取 SHALL 返回无会话、非加载状态，不注册真实会话刷新或产生网络请求；非读取认证操作 SHALL 明确报告不支持。上游源码与依赖可继续同步，但不得成为禁用时的回退实现。

#### Scenario: 上游会话不发请求

- **WHEN** UI 调用 useSession，或界面/后台调用 getSession
- **THEN** 返回符合消费契约的无会话结果，不保持 pending、不联网、不启动刷新订阅

#### Scenario: 上游认证操作与自有认证分离

- **WHEN** 旧入口尝试调用上游认证操作，或者任译喵用户已处于登录状态
- **THEN** 上游认证操作被本地拒绝而非伪装成功，自有会话、会员 token 和官网认证联动不受影响
