## Why

translatebuff 是 read-frog（上游 `mengxi-ream/read-frog`）的软 fork：要重做前端 UI、自建会员/登录，但持续复用并同步上游的 background/翻译引擎。当前仓库 `main` 只是上游提交的镜像，尚无任何 fork 隔离机制、后端指向仍是 readfrog.app、也无防止"改到高频共享文件导致合并地狱"的护栏。本变更建立 fork 的基础架构与上游同步机制，并闭合架构评审提出的四个阻塞项（B1-B4），让后续 UI 重建与会员开发能在一个可持续同步上游的地基上进行。

## What Changes

- 建立上游同步拓扑：新增 `upstream` remote、校验共享祖先、启用 `rerere`、落盘 `FORK.md` 同步仪式（只 merge 不 rebase/squash）。
- 建立 fork 隔离：所有净新增代码进 `src/fork/**`；用 CI 边界检查（allowlist + 三浏览器构建门）阻止越界改到上游热点文件。
- **B1** 独立发版：manifest `version` 由上游 3 段版本派生 4 段号（`pkg.version.forkBuild`），品牌走 `version_name`；fork 停用 changesets。
- **B3** 后端指向：force-add `.env.production` 把 4 个 URL/origin/domain 指向 translatebuff 后端；构建后断言产物内无 readfrog 域名（防 shell 残留 `WXT_*` 静默打包旧域名）。v1 保留 better-auth 指向自有后端（不改认证客户端）。
- **B2** 配置隔离：fork 专属设置使用独立 storage key + 独立 zod schema + 独立迁移链，绝不进上游 `configSchema`。
- fork 运行时接入：独立 `ForkProtocolMap` 消息通道；`setupFork()` 单行接入上游 `background/index.ts`；`app.tsx` 壳层模式（以 popup 为参考页）承载 fork UI。
- 去品牌：`APP_NAME`、卸载调研 URL 指向 fork。
- **BREAKING**（相对上游）：扩展身份（name/version/gecko.id）与后端域名改为 translatebuff，与上游产物不再兼容——这是 fork 的预期结果。

不在本变更范围（后续独立变更）：完整 UI 重建（options/sidepanel/translation-hub/内容脚本全部界面）、会员后端实现、中国大陆登录方式（手机/微信/邮箱）、free-AI provider 处置。

## Capabilities

### New Capabilities

- `upstream-sync`: 从上游安全同步的 git 拓扑与仪式（remote、共享祖先不变量、merge-only、rerere、lockfile 处理、同步节奏）。
- `fork-boundary-guard`: fork 代码隔离与越界防护（`src/fork/**` 命名空间、in-place 编辑 allowlist、CI 边界检查 + 三浏览器构建门）。
- `fork-identity`: fork 扩展身份与发版（独立 4 段 manifest 版本、品牌名、gecko.id、去品牌的 APP_NAME 与卸载调研 URL）。
- `fork-backend-repoint`: 后端与环境指向（`.env.production` 覆盖 4 个 URL/origin/domain、构建产物无上游域名断言、v1 保留 better-auth）。
- `fork-settings-store`: fork 专属配置的隔离存储（独立 storage key + schema + 迁移链，与上游 configSchema 完全解耦）。
- `fork-runtime-integration`: fork 运行时接入上游引擎（独立消息通道、单行 `setupFork()` 后台接线、`app.tsx` 壳层 UI 承载模式）。

### Modified Capabilities

<!-- 无既有 openspec/specs；本仓首次引入 spec，均为新能力。 -->

## Impact

- 新增：`src/fork/**`（message/branding/identity/config/background/ui）、`FORK.md`、`.env.production`（force-add）、`scripts/check-fork-boundary.mjs`、`scripts/fork-allowlist.json`、`scripts/assert-fork-build.mjs`、`.github/workflows/fork-guard.yml`。
- 原地编辑（allowlist 内）：`wxt.config.ts`（name/version/gecko.id）、`src/entrypoints/background/index.ts`（一行 setupFork）、`src/utils/constants/app.ts`（APP_NAME）、`src/entrypoints/popup/app.tsx`（壳层）、`src/entrypoints/background/uninstall-survey.ts`（调研 URL）。
- 依赖/工具：停用 fork 上的 changesets（删 `.changeset`）；新增 upstream remote；git 配置 `rerere.enabled=true`。
- 不改：上游翻译引擎（`src/utils/host/translate/*`）、`src/utils/message.ts` ProtocolMap、配置 schema/迁移脚本、`models.ts`/`providers.ts`（全部 take-theirs）。
