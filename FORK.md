# Translatebuff Fork Playbook

Translatebuff 是 read-frog 的软 fork（上游：mengxi-ream/read-frog）。
我们重做 UI、自建会员，但持续复用并同步上游引擎。

## 同步仪式（按上游 changeset release，或每周一次）

1. `git fetch upstream`
2. `git switch -c sync/$(date +%Y-%m-%d) main`
3. `git merge upstream/main` # 只 MERGE —— 绝不 rebase/squash main
4. 解冲突。热点一律 take-theirs（见下）。
5. `pnpm install` # 重新生成 pnpm-lock.yaml；绝不手工合并
6. `pnpm run test` 与 `wxt build` + `build:edge` + `build:firefox` 必须全绿
7. `node scripts/assert-fork-build.mjs` 必须通过（fork 域名已进产物 = env 覆盖生效；残留上游域名仅告警）
8. 边界检查必须通过。**同步分支走同步模式**：`FORK_SYNC_MODE=1 node scripts/check-fork-boundary.mjs`
   （基准取本次合并进来的上游提交；HEAD 已不是合并提交时补 `FORK_SYNC_BASE=<上游落脚点>`）。
   日常 PR 走增量模式 `FORK_DIFF_BASE=origin/<base> …`。用错模式会全判红或空转恒绿，两者都危险。
   判定看的是「与上游是否**仍有分歧**」，把 fork 改动退回上游不算越界。
9. `node scripts/check-fork-brand.mjs` 必须通过（locale/入口标题无上游品牌残留、无小写 Translatebuff 漂移）。上游新增带 "Read Frog" 的串会在此被揪出——重刷成 fork 品牌（拉丁 TranslateBuff / 中文 任译喵·任譯喵）
10. 开 PR：sync/* -> main（CI `fork-guard.yml` 复跑 4/5/7/8/9）

## 绝不编辑（每次同步 take-theirs）

- src/utils/message.ts（ProtocolMap）
- src/types/config/* schema、src/utils/constants/config.ts DEFAULT_CONFIG
- src/utils/config/migration-scripts/*
- src/utils/constants/models.ts、src/utils/constants/providers.ts
- package.json `version`、CHANGELOG.md、pnpm-lock.yaml
- .changeset/（保留 take-theirs、休眠；**fork 永不运行 `changeset version`/`release`**，避免删除目录导致每次同步 modify/delete 冲突）

## 被 fork 影子接管的上游文件（每次同步必须手工对账）

这些上游文件**仍在仓库里、仍会被 merge 更新，但运行时不再执行**——`wxt.config.ts` 的
`FORK_UI_REDIRECTS` 把模块解析重定向到了 `src/fork/` 副本。它们不会产生 merge 冲突
（fork 没改过原文件），代价是**上游对它们的后续修复不会自动生效**，而
`forkUiRedirectPlugin` 的 buildStart **只断言路径存在、不比对内容**——上游改了内容，
构建照样绿，没人会知道。

| 上游文件                                                                           | fork 副本                                                  | 同步时要留意什么                                                                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| src/utils/host/translate/api/microsoft.ts                                          | src/fork/providers/microsoft-translate.ts                  | 端点/请求形状变更；上游改动频率最高                                                                            |
| src/entrypoints/host.content/translation-control/bind-translation-mode-shortcut.ts | src/fork/ui/host-content/bind-translation-mode-shortcut.ts | 上游已把 `config.translate` 改名为 `config.pageTranslation`、i18n key 也重组                                   |
| src/entrypoints/options/pages/translation/translation-mode.tsx                     | src/fork/ui/options/translation-mode.tsx                   | 必须保留具名导出 `TranslationMode` 与 `ConfigCard id="translation-mode"`（命令面板靠该 id 跳转，改了静默断链） |

（其余 8 条重定向是纯换皮 UI，本表只列「上游会继续演进、漏看会出功能问题」的三个。）

> **2026-08-25 更新**：`buildStart` 现在**同时断言内容指纹**（`src/fork/identity/redirect-baseline.json`，
> LF 归一化后 sha256）。上游改了被换皮文件的内容会直接构建失败，不再是「构建绿但皮悄悄掉」。
> 失配后必须**先 diff 上游改动、判断要不要搬进 fork 副本，再更新指纹**——直接刷新指纹等于把这层护栏关掉。
> 重定向未登记指纹同样硬失败，避免新增换皮漏进护栏之外。
>
> 重定向已从 11 条增至 20 条（阶段 0 还债后）。品牌图标改走**资源级重定向**
> （`src/assets/icons/read-frog.png` → `src/fork/assets/renyimiao.svg`），一条覆盖悬浮球与字幕条两处，
> 省掉两份要逐次对账的组件副本。

**每次 merge 完上游，除常规门禁另加三步：**

1. `git diff <上次同步的上游 commit>..upstream/main -- <上表三个路径>`，逐条判断上游改动要不要手工搬进 fork 副本。
2. 看漂移哨兵 `src/fork/providers/__tests__/upstream-decode-drift.test.ts` 是否变红。红了 =
   上游把 `microsoft-translate` 加进了 `normalizeTranslationOutput` 的解码集合，**此时必须删掉
   fork 适配器里的 `decodeHTMLStrict`**，否则双重解码会把 `&amp;` 静默塌成 `&`——不冲突、不报错、极难查。
3. 若同步到了上游 `config.translate` → `config.pageTranslation` 改名的那一版，
   `src/fork/providers/translation-only-gate.ts` 的 featureKey 与三个 fork 副本读的字段要一起改。

**注意**：重定向在 vitest 下**不生效**（`vitest.config.ts` 只注册 `WxtVitest()`，它不转发
`wxt.config.ts` 的 `vite()` 钩子）。所以上游原版测试会继续绿但测的是休眠代码；fork 副本的逻辑
必须在 `src/fork/**/__tests__/` 里直接 import fork 模块补测，别指望继承上游测试。

## 发版号与打包（B1）

- manifest `version` 走 fork 自主 semver，存 `src/fork/identity/fork-version.json` 的 `version`（当前 `1.0.1`），
  与上游 `package.json` 版本解耦；version_name 保留上游溯源，如「任译喵 1.0.0（rf 1.42.2）」。
- 发新版：直接改 `fork-version.json` 的 `version`（1.0.0 → 1.0.1 → 1.1.0 → 2.0.0 全自由）。Chrome 要求
  manifest version 为纯数字段，故测试包与正式包**同版本号**，靠后端 + 文件名区分。
- `package.json version` 与 `CHANGELOG.md` 仍一律 take-theirs（version 字段绝不 fork 改），绝不在 fork 上跑 changesets。
- 打包两条轨（`scripts/pack.mjs`，产物落 `.output/`）：
  - `node scripts/pack.mjs test` —— 测试后端（本地 `.env`）→ `translatebuff-<版本>-test-chrome.zip`，内部试用（load unpacked）。
  - `node scripts/pack.mjs store` —— 正式后端（`.env.production`）→ `translatebuff-<版本>-chrome.zip`，上传 Chrome Web Store。

## 文件四分类与冲突解法

同步时每个文件落入以下四类之一：

### A 类 · 绝不改（take-theirs，改了必冲突）

- src/utils/message.ts（ProtocolMap）
- src/types/config/**、src/utils/constants/config.ts（DEFAULT_CONFIG）
- src/utils/config/migration-scripts/**
- src/utils/constants/models.ts、src/utils/constants/providers.ts
- package.json `version`、CHANGELOG.md、pnpm-lock.yaml、.changeset/**
- **冲突解法**：`git checkout --theirs <file>` 全盘接受上游；fork 要扩能力只进 src/fork/。

### B 类 · 允许原地改（allowlist，每次同步可能手工解冲突）

真源清单见 `scripts/fork-allowlist.json`；向其增项需评审。当前实际改动的 5 个：

- wxt.config.ts（name / version / gecko.id）
- src/entrypoints/background/index.ts（一行 setupFork()）
- src/utils/constants/app.ts（APP_NAME）
- src/entrypoints/popup/app.tsx（壳层 re-export）
- src/entrypoints/background/uninstall-survey.ts（survey URL）
- （allowlist 另预列 options/sidepanel/translation-hub/side/selection 的 app.tsx、selection/index.tsx、auth/orpc client、9 个 locale，留给后续 UI 重建 / 会员替换）
- **冲突解法**：手工合并——保留 fork 那几行，其余接受上游。rerere 已开，会记住重复解法。

### C 类 · fork 净新增（零冲突，上游永不碰）

- src/fork/**、scripts/{check-fork-boundary,assert-fork-build,check-fork-brand}.mjs、scripts/fork-allowlist.json、FORK.md、.env.production、.github/workflows/fork-guard.yml、openspec/**
- **冲突解法**：不会有。

### D 类 · 直接从上游同步（其余全部 = 引擎，take upstream）

- `src/utils/host/translate/**`（翻译引擎）、`src/entrypoints/background/`（除 index.ts）、content-scripts 注入逻辑、`src/utils/`、`src/hooks/`、未 fork 的 `src/components/` 等
- **操作**：merge 自动合入，无需干预。
- `@read-frog/definitions` / `@read-frog/api-contract`：**升版本号即同步**（take 上游 package.json + `pnpm install`）；升前 diff 其常量（AUTH_BASE_PATH / ORPC_PREFIX / AUTH_COOKIE_PATTERNS / orpc 形状）防契约漂移。

## 不变量

- 只 merge，绝不 rebase/squash main 上的上游提交（否则毁掉便宜三方合并的共享祖先）。
- 所有净新增代码进 src/fork/**。
- fork 配置使用独立 storage key + schema + 迁移链；绝不触碰上游 configSchema。
