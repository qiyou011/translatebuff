## Context

translatebuff 需要在长期复用 read-frog 引擎的前提下重做 UI、自建会员。read-frog 上游是 monorepo（`read-frog-monorepo`），本仓是其 extension app 抽取出的单个 WXT 包；`main` 当前逐一镜像上游提交 SHA，`upstream` remote 尚未配置。引擎的一部分经 npm 包（`@read-frog/definitions`、`@read-frog/api-contract`）分发，可经升版本号同步。UI↔background 的唯一契约是 `src/utils/message.ts` 里单个 `defineExtensionMessaging<ProtocolMap>()`。后端指向集中在 `src/env/shared.ts` + `src/utils/orpc/*` + `src/utils/auth/*`，全走 `env.WXT_API_URL` + background `backgroundFetch` 代理。

本设计已经过 architect-review（裁决：需修改后通过），四个阻塞项 B1-B4 的修法已并入下述决策。锁定的产品决策：域名 `translatebuff.com`/`api.translatebuff.com`（占位）；v1 保留 better-auth；v1 仅中国大陆登录（Google OAuth 墙内不通，登录方式由后续会员变更在服务端实现）。

## Goals / Non-Goals

**Goals:**

- 建立一个可持续、低冲突地从上游 merge 同步的 fork 地基。
- 净新增代码零碰撞隔离；上游热点文件 take-theirs、原地编辑面显式受控。
- 后端指向 fork、身份/版本独立可上架、fork 配置与上游 configSchema 解耦。
- 提供 UI/内容脚本改造的可复用模式（以 popup 为参考页）。

**Non-Goals:**

- 完整 UI 重建（options/sidepanel/translation-hub/内容脚本全部界面）。
- 会员后端实现与中国大陆登录方式（手机/微信/邮箱）。
- free-AI 托管 provider 的处置、Notebase 处置。
- 彻底替换 better-auth（v1 保留，后续变更再做）。

## Decisions

### D1: 软 fork 单包 + git-merge 追上游（而非拆包/subtree）

保持单 WXT 包与 1:1 目录，绝不挪动上游文件；净新增进 `src/fork/**`。

- **理由**：`main` 与 `upstream/main` 现有共享祖先使 3-way merge 便宜；一旦 squash/repackage 即失去该属性。引擎深度 import `@/utils/*` 与 WXT 虚拟模块、按入口约定自动发现，拆成消费型库是与框架长期对抗。
- **备选**：① 拆引擎为 npm 包——上游未发布引擎库，需重导出海量内部并重接 WXT 构建，违反 KISS/YAGNI，驳回。② git subtree vendor——WXT 单包模型抵触双包切分，vendored 文件仍会冲突，驳回。

### D2: merge-only 同步，永不 rebase/squash main（含 rerere、lockfile 重生成）

- **理由**：长期发布型共享 fork，rebase 会在整条 fork 栈上反复重解同一冲突；merge 每个冲突只解一次并保稳定 SHA。lockfile 由 `pnpm install` 重生成而非手工合并。
- **备选**：rebase 同步——历史更线性但对已发布 fork 破坏性大，驳回。

### D3: 后端指向靠 `.env.production`（B3），不编辑 `src/env/shared.ts`

运行时值走 Vite `import.meta.env`，prod 下 `.env.production` 必进且校验失败为 loud（守卫 throw）。

- **理由**：零上游编辑即重定向 auth/orpc/深链。**风险点**：shell 里残留的 `WXT_*` 优先级高于 `.env` 文件——故 CI build 前 `unset WXT_*`，并对产物做"无 readfrog 域名"断言兜底。
- **备选**：改 `src/env/shared.ts` 默认值——每次上游动该文件即冲突，驳回。

### D4: 会员切换用原地 re-export 桩，不用 wxt `alias`（仅未来彻底替换时）

若将来彻底弃 better-auth，在上游 client 文件里 `export * from '@/fork/membership/...'`。

- **理由**：wxt `alias` 同时灌 tsconfig（最长前缀）与 Vite（数组首匹配），与默认 `@`→src 竞争，可能 tsc 绿而 Vite 仍打包上游 auth = 静默认证失效；原地 re-export 对 tsc 与 Vite 都确定，且上游改动会 loud 冲突（正是需要的通知）。
- **v1 现状**：保留 better-auth，本决策不落地，仅作后续配方；v1 只做 D3 的环境指向。

### D5: fork 配置独立 storage key + 独立 schema + 独立迁移链（B2）

- **理由**：向上游 `configSchema` 加字段必然改 `config.ts`/`DEFAULT_CONFIG`/`configFieldsAtomMap`/迁移脚本——全是 tier-1 热点。彻底隔离后上游迁移目录对 fork 永远 take-theirs、零冲突。**据此删除**早期"fork migration 编号排上游之上"的自相矛盾主张。
- **备选**：把 fork 配置塞进上游 schema——制造永久 config.ts 冲突，驳回。

### D6: 独立 4 段发版号（B1），停用 fork 上的 changesets

manifest `version = ${pkg.version}.${forkBuildNumber}`（Chrome/Edge 支持 4 段），品牌走 `version_name`；`package.json version` 与 `CHANGELOG.md` 纯 take-theirs。

- **理由**：`version_name` 不参与商店排序，纯 take-theirs 会导致 fork 在两个上游版本间无号可发；4 段号解耦发版。停 changesets 避免每个 release 撞 `version`/`CHANGELOG` 顶部。
- **备选**：fork 跑独立 changesets——与上游同一 cadence 撞车，驳回。

### D7: 边界纪律机械化（allowlist + CI + 三浏览器构建门）

把 in-place 编辑面显式枚举成 `scripts/fork-allowlist.json`（含 9 个 locale、`app.ts`、wxt.config、auth/orpc、selection harness、app.tsx 壳），CI 对越界 diff fail sync PR。

- **理由**：软 fork 唯一的失效模式是"手滑改了热点文件"；纪律必须机械化而非靠自觉。

### D8: 身份/去品牌走已编辑文件，selection 原地改 JSX

manifest name 在 wxt.config 工厂写字面量（不动 9 个 locale）；`APP_NAME` 指 fork 品牌；`uninstallSurveyUrl` 从 env/fork 常量读。selection.content 交织文件原地改 JSX、保留检测/定位/请求逻辑。

- **理由**：fork-copy+alias 会让上游修复静默合进不加载的死文件而丢失；原地改虽每次手工冲突，但保留上游 bug 修复的可见性。

## Risks / Trade-offs

- [越界误改热点文件] → allowlist + CI 边界检查 + CODEOWNERS 机械阻断。
- [shell 残留 `WXT_*` 静默打包旧域名] → CI `unset WXT_*` + 产物域名断言。
- [selection.content 高频冲突] → 接受每次手工 re-port；rerere 缓解不消除；UI 抽 `src/fork/ui`、harness 只留一行挂载以压缩冲突面。
- [契约包漂移（`api-contract`/`definitions` 升版移端点/cookie 模式）] → pin 版本，升前 diff 常量；后端认常量使升版为 no-op。
- [失去共享祖先（误 squash/rebase main）] → FORK.md 明令 merge-only + 团队约定。
- [telemetry required 项被误删] → 给 fork 自有 PostHog/Google key 或 `WXT_SKIP_ENV_VALIDATION`+stub，绝不删 prod schema。
- [WXT/构建耦合（上游升 WXT 破坏入口发现或 alias）] → 每次同步三浏览器 smoke build。

## Migration Plan

1. 建同步拓扑（upstream remote、共享祖先校验、rerere、FORK.md）。
2. 建 `src/fork/**` + 边界 CI（allowlist + 构建门）。
3. B1 版本号 → B3 env → （v1 跳过 D4 会员桩）→ B2 fork 配置 → setupFork 接线 → UI 壳层参考页 → 去品牌 → 停 changesets。
4. 演练一次 `git merge upstream/main`（今日因共享祖先应 trivial），验证 lockfile 重生成 + 三浏览器构建 + 域名断言全绿。

- **回滚**：本变更全部改动集中在 fork 新增文件与 allowlist 内少数上游文件；异常时 `git revert` 相应提交即恢复到上游镜像态。

## Open Questions

- v1 不上 Google 登录时 `WXT_GOOGLE_CLIENT_ID`（prod required）如何满足：占位值 vs `WXT_SKIP_ENV_VALIDATION`+analytics stub——由后续会员变更定夺。
- fork 与上游可能同机并存时，`read-frog-selection` shadow-root 名与 `__READ_FROG_*__` page-global guard 是否随 `APP_NAME` 一并改名（避免撞车）。
