## Why

fork 在上游文件里原地改 UI，欠下了一笔同步债。干跑合并上游 v1.46.4 有 **34 个冲突文件，其中 22 个的根因就是这批原地改动**；而合到 options 重构之前的 v1.43.6 只有 5 个冲突。这笔债不还，每次同步都要把同样的冲突重解一遍，且冲突面随上游迭代只增不减。

`FORK_GUIDE.md` §4 的反冲突铁律早已写明「重度定制的整块 surface 一律走换皮壳（C 类），绝不在 churning 共享文件上原地改」，但护栏只在 PR 增量上跑（`FORK_DIFF_BASE=origin/main`），拦不住已经进了 main 的存量越界。以分叉点为基准复测，越界文件累计 **110 个**。

本变更是上游同步三阶段的**阶段 0**：先还债，把冲突面从 34 压到 12，再分两段合上游（v1.43.6 → v1.46.4）。

## What Changes

按分叉点 `e15e5b68` 复测出的 110 个越界文件，分四档处理：

- **回退档 · 回退到上游视觉（41 个）**：base-ui 组件、`theme.css`、options/popup/translation-hub 的 className 与排版微调，整档丢弃 fork 改动、取上游版本。**【破坏性变更】** 插件视觉回到上游 read-frog 样式，fork 皮肤留到后续 UI 重建时用换皮壳重做。
- **搬迁档 · 搬进 `src/fork/**`（29 个）**：品牌接线（`getWebsiteUrl`、任译喵 logo、`BrandMark`）、隐藏上游入口（Discord、GitHub issues、上游商店评价）、fork 逻辑（`overlay-feature-preview`、popup/sidepanel 壳接线、provider 去重修复、v085 迁移补丁）。功能一个不丢，落点全部改到 fork 领地。
- **清除档 · 丢弃或 take-theirs（8 个）**：上游已删的两个 options 页、fork 自造的 5 个 changeset、`migration.ts`（上游已有等价实现，取上游）。
- **资源档 · fork 身份资源（32 个）**：3 个 fork 净新增（`src/assets/icons/renyimiao.svg`、`assets/renyimiao-icon.svg`、`.gitattributes`）迁到 `src/fork/assets/`，由既有 `src/fork/**` 规则自动放行；余下 29 个上游素材替换**逐文件写进 allowlist 的 `files` 数组**（不用前缀——前缀会让日后往同目录丢 `.ts` 被静默放过）。

同时修两处护栏缺陷：

1. **触发面**：`fork-guard.yml` 只在 `on: pull_request: branches: [main]` 触发，而 109/110 的越界来自一次直接 `git merge` 本地分支进 `change/fork-foundation`——护栏根本没跑。改为对所有分支的 PR 生效。
2. **模式**：脚本的三点 diff 在同步分支上会把全量上游改动（290 / 800 个文件）判成越界，直接锁死阶段 1/2。拆成「增量模式」（日常 PR）与「同步模式」（`feat/upstream-sync-*`，基准取上游落脚点），基线 SHA 存进机读真源 `src/fork/identity/upstream-baseline.json`。

## Capabilities

### New Capabilities

- `fork-ui-shell-boundary`: fork UI 只能以换皮壳（`src/fork/ui/**` + `FORK_UI_REDIRECTS`）形式存在，禁止原地改上游 UI 文件；含存量全量扫描与新增违规拦截。

### Modified Capabilities

- `fork-boundary-guard`: allowlist 保持「逐文件枚举 + 增项评审」语义（新增 32 项资源与配置文件，**不引入前缀**）；CI 触发面扩展到所有分支的 PR；新增同步模式，基准取合并提交的第二父提交而非 `origin/<base_ref>`。
- `fork-provider-ui`: provider logo 与展示层覆盖从原地改 `provider-display.ts` / `provider-registry.ts` 改为换皮重定向。

## Impact

- **视觉全面回退**：所有页面（popup、options、翻译浮窗、字幕、translation-hub）外观回到上游样式，只保留品牌 logo 与站点链接。需产品侧确认可接受。
- **换皮重定向清单扩容**：`FORK_UI_REDIRECTS` 从 11 条增加到约 25 条，`ui-redirect-plugin` 的 buildStart 断言随之覆盖更多上游路径——上游一旦移动这些文件，构建会硬失败（预期行为）。
- **测试基线变动**：跟随视觉改过的 3 个上游测试文件回退，fork 侧新增对应测试。
- **不涉及**：翻译引擎、会员/登录、配置 schema、后端契约均不改动。
- **后置依赖**：本变更完成并全绿后，才启动 `upstream-sync-v1-43-6`（阶段 1）与 `upstream-sync-v1-46-4`（阶段 2）。
