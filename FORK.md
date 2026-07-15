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
8. `FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs` 必须通过（无 allowlist 外越界）
9. 开 PR：sync/* -> main（CI `fork-guard.yml` 复跑 4/5/7/8）

## 绝不编辑（每次同步 take-theirs）

- src/utils/message.ts（ProtocolMap）
- src/types/config/* schema、src/utils/constants/config.ts DEFAULT_CONFIG
- src/utils/config/migration-scripts/*
- src/utils/constants/models.ts、src/utils/constants/providers.ts
- package.json `version`、CHANGELOG.md、pnpm-lock.yaml
- .changeset/（保留 take-theirs、休眠；**fork 永不运行 `changeset version`/`release`**，避免删除目录导致每次同步 modify/delete 冲突）

## 发版号（B1）

- manifest `version` 由 `wxt.config.ts` 从上游 `package.json` 版本派生 4 段号：`${pkg.version}.${forkBuildNumber}`。
- fork 自有发版：改 `src/fork/identity/fork-build.json` 的 `forkBuildNumber`（跟进新上游版本时归零）。
- `package.json version` 与 `CHANGELOG.md` 一律 take-theirs，绝不在 fork 上跑 changesets。

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

- src/fork/**、scripts/{check-fork-boundary,assert-fork-build}.mjs、scripts/fork-allowlist.json、FORK.md、.env.production、.github/workflows/fork-guard.yml、openspec/**
- **冲突解法**：不会有。

### D 类 · 直接从上游同步（其余全部 = 引擎，take upstream）

- `src/utils/host/translate/**`（翻译引擎）、`src/entrypoints/background/`（除 index.ts）、content-scripts 注入逻辑、`src/utils/`、`src/hooks/`、未 fork 的 `src/components/` 等
- **操作**：merge 自动合入，无需干预。
- `@read-frog/definitions` / `@read-frog/api-contract`：**升版本号即同步**（take 上游 package.json + `pnpm install`）；升前 diff 其常量（AUTH_BASE_PATH / ORPC_PREFIX / AUTH_COOKIE_PATTERNS / orpc 形状）防契约漂移。

## 不变量

- 只 merge，绝不 rebase/squash main 上的上游提交（否则毁掉便宜三方合并的共享祖先）。
- 所有净新增代码进 src/fork/**。
- fork 配置使用独立 storage key + schema + 迁移链；绝不触碰上游 configSchema。
