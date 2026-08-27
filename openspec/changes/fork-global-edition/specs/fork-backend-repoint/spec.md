## MODIFIED Requirements

### Requirement: 后端环境指向（B3）

系统 SHALL 通过 force-add 的正式环境配置覆盖 `WXT_API_URL`、`WXT_WEBSITE_URL`、`WXT_OFFICIAL_SITE_ORIGINS`、`WXT_AUTH_COOKIE_DOMAINS` 为 fork 后端，而不编辑 `src/env/shared.ts`。正式环境配置 MUST 按 edition 分为两份：国内线沿用 `.env.production`，海外线使用独立的海外配置文件。海外线的登录后端域（`WXT_RENYIMIAO_API_URL`）与翻译网关域（`WXT_RENYIMIAO_GATEWAY_URL`）在后端提供正式值之前 MUST 以海外官网域占位，MUST NOT 留空。

#### Scenario: 生产构建指向 fork 后端

- **WHEN** 在无残留 `WXT_*` 环境变量的干净环境下、存在 `.env.production` 时执行 `pnpm run build`
- **THEN** 构建成功，运行时环境的 4 个 URL/origin/domain 均为 fork 值

#### Scenario: 满足生产环境校验

- **WHEN** 生产构建校验 `WXT_GOOGLE_CLIENT_ID`、`WXT_POSTHOG_HOST`、`WXT_POSTHOG_API_KEY` 等 required 项
- **THEN** 该 edition 的正式配置提供了这些必填项（以占位或 fork 自有值满足），构建守卫不抛错

#### Scenario: [API层] 海外线取 .com 官网域与授信 origin

- **GIVEN** edition 为 `global`
- **WHEN** 读取运行时环境
- **THEN** `WXT_WEBSITE_URL` MUST 为官网实际部署的 host（带 `www` 的 `.com` 域，而非只做 301 跳转的裸域）
- **AND** `WXT_OFFICIAL_SITE_ORIGINS` MUST 同时含裸域与 `www` 两个 `.com` origin
- **AND** `WXT_AUTH_COOKIE_DOMAINS` MUST 为 `translatebuff.com`

#### Scenario: [API层] 登录后端域缺失即构建 fail-fast

- **GIVEN** 任一 edition 的正式配置中 `WXT_RENYIMIAO_API_URL` 缺失或为空
- **WHEN** 执行构建后断言
- **THEN** MUST 抛错终止构建
- **AND** 错误信息 MUST 指明登录将取到 `undefined`

#### Scenario: [API层] 两线配置文件互不覆盖

- **GIVEN** 仓内同时存在国内与海外两份正式配置
- **WHEN** 以某一 edition 构建
- **THEN** 仅该 edition 的配置值 MUST 进入产物
- **AND** 另一 edition 的域名 MUST NOT 出现在产物中
