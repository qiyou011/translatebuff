## Context

fork 与上游 read-frog 共享 git 祖先，分叉点 `e15e5b68`（v1.42.2）。fork 侧 81 个提交里，有一批把品牌化和视觉定制**直接写进了上游源文件**，违反 `FORK_GUIDE.md` §4 的反冲突铁律。

以分叉点为基准跑边界检查，累计越界 **110 个文件**。这批越界直接决定了同步成本：

```
$ git merge-tree --write-tree --name-only change/fork-foundation fe2957c8   # 上游 v1.46.4
冲突 34 个   —— 其中 22 个是越界文件
$ git merge-tree --write-tree --name-only change/fork-foundation 53b54d68   # 上游 v1.43.6
冲突 5 个
```

现有护栏 `scripts/check-fork-boundary.mjs` 只跑 PR 增量（`FORK_DIFF_BASE=origin/main`），对已进 main 的存量越界完全无感；`FORK_UI_REDIRECTS` 换皮机制已存在且成熟（11 条重定向 + buildStart 存在性断言），但覆盖面不够。

## Goals / Non-Goals

**Goals:**

- 把 110 个越界文件清零，让存量边界扫描输出为空
- 视觉回退到上游，同时**一个 fork 功能都不丢**（品牌接线、隐藏上游入口、fork 逻辑全部保留）
- 上游 v1.46.4 的合并冲突从 34 降到 12（9 个 locales + `wxt.config.ts` + `app.ts` + `popup/app.tsx`，全在 allowlist 内）
- 边界检查新增存量扫描模式，把「不许原地改上游 UI」变成机械红线

**Non-Goals:**

- 不做上游合并本身（阶段 1/2 各自立项）
- 不重建 fork 视觉设计系统（后续 UI 重建变更做，届时走换皮壳）
- 不动翻译引擎、会员/登录、配置 schema、后端契约
- 不修改上游已有测试的断言语义（跟随视觉回退的测试直接取上游版）

## Decisions

### 决策 1：四档分类，而不是整仓 checkout 上游

**为什么不能整文件 `git checkout upstream -- <file>`**：视觉改动和品牌接线**混在同一个文件里**。例：`src/components/api-config-warning.tsx` 一次改动既换了 className，又把 `href="https://readfrog.app/docs/api-key"` 换成 `getWebsiteUrl("/docs/api-key")`。整文件回退会把品牌接线一起抹掉。

因此逐文件分四档：

| 档     | 数量 | 处理                                                                                         |
| ------ | ---- | -------------------------------------------------------------------------------------------- |
| 回退档 | 41   | `git checkout <分叉点> -- <file>` 取回上游版本，fork 改动整体丢弃                            |
| 搬迁档 | 29   | 上游文件回退到上游版本，fork 行为搬进 `src/fork/**`，加换皮重定向                            |
| 清除档 | 8    | 上游已删的两个 options 页、fork 自造 changeset、`migration.ts` 取上游                        |
| 资源档 | 32   | 3 个 fork 净新增迁 `src/fork/assets/`；29 个上游素材替换**逐文件写进 allowlist**（见决策 7） |

> ⚠️ 这四个档位与 `FORK.md` 的 A/B/C/D 类**没有任何对应关系**，语义甚至相反（FORK.md 的 B 类 = 允许原地改，本文的搬迁档 = 禁止原地改）。刻意不用字母命名以免误读。

### 决策 2：搬迁档一律用「换皮重定向」，不用「上游文件里 re-export」

两种做法都能零冲突，但 re-export 仍然要编辑上游文件（allowlist 会持续膨胀），而重定向完全不碰上游源码。既有 11 条重定向已验证该模式可用，扩到约 25 条是同一套机制的线性延伸。

代价是 `ui-redirect-plugin` 的 buildStart 断言面变大——上游移动任一被换皮文件，构建会硬失败。这是**期望行为**：失败总比静默掉皮好，本次排查已经证明它有效（上游 options 重构移动了 4 个文件，断言会全部报出来）。

### 决策 3：`provider-display.ts` / `provider-registry.ts` 改走重定向

这两个文件目前被原地改（fork logo 解析、`BUILT_IN_AI_PROVIDER_LOGO` 换成任译喵图标），且上游改动频繁（各 2 次 / 5 次）。改为 fork 模块 + 重定向，把它们从冲突面上摘掉。

### 决策 4：`v085-to-v086.ts` 的 customActions 修复改做后台幂等修复，不进 fork 迁移链

上游把迁移脚本定义为**冻结快照**（文件头注释明写「never import constants or helpers that may change」）。fork 往里塞了 50 行 customActions 修复逻辑，违反该不变量。

但它也不能搬进 `src/fork/config/migration.ts`：那条链只服务 fork 自己的 storage key（`loadForkConfig` 读 `local:FORK_CONFIG_STORAGE_KEY`），而这段修复修的是**上游配置**的 `selectionToolbar.customActions`。更要命的是，回退 `v085-to-v086.ts` 之后，schemaVersion 已 ≥86 的存量用户再也不会经过那一步，修复会静默丢失。

改做后台幂等修复：新建 `src/fork/background/repair-custom-actions.ts`，由 `setupFork()` 调用，读上游 config、发现残缺就补齐、读到 null 就跳过。形态照抄同目录已有的 `correct-legacy-translation-mode.ts`——那是本仓已验证可用的「fork 侧修上游配置」范式。

### 决策 5：`migration.ts` 取上游

fork 和上游**各自独立**给迁移链加了连续性校验，逻辑几乎一致，上游那版还抽成了可测的 `buildMigrationRegistry(discoveredModules, firstVersion, latestVersion)`。直接 take-theirs，fork 版删除。注意：本档在阶段 0 只做「回退到分叉点版本」，`buildMigrationRegistry` 要等阶段 1/2 合并后才进来。

### 决策 6：不扩 allowlist，补的是护栏「触发面」

初稿曾提出给 allowlist 加 `assetPrefixes` 资源前缀，用来让存量扫描输出为空。**该方案已废弃**——它为了让一个一次性测量工具好看，去永久放宽一道安全护栏。前缀式放行意味着日后任何人往 `src/assets/icons/` 丢一个 `.ts` 都会被静默放过，而 allowlist 现有语义是「逐文件枚举 + 增项评审」，前缀与之直接冲突。

复查后定位到真正的洞：

```
$ git log --format='%h %ad %an %s' --date=short -1 d08b3fc1
d08b3fc1 2026-07-16 jinboamen feat(ui): 统一任译喵界面并修复插件弹窗
   155 files changed, 1481 insertions(+), 900 deletions(-)
   与 110 个越界文件的交集：109

$ git log --oneline --ancestry-path d08b3fc1..main --merges | tail -1
ffd493e7 Merge branch 'UI-optimization' into change/fork-foundation
```

`fork-guard.yml` 早在 2026-07-15（`213409ae`）就已就位，比这次越界早一天。它没拦住，是因为触发条件是 `on: pull_request: branches: [main]`，而这批改动是**直接 `git merge` 本地分支进 `change/fork-foundation`**——既不是 PR，目标分支也不是 `main`，工作流从头到尾没运行过。

所以修法是补触发面，不是放宽判定：

1. `fork-guard.yml` 去掉 `branches: [main]` 限制，对所有分支的 PR 生效
2. 长期分支（`main`、`change/*`）约定只接受 PR 合入，禁止本地 merge 直推
3. `FORK_SCAN_ALL=1` **降级为一次性排查工具**，不进 CI 门禁、不要求输出为空

### 决策 6b：护栏必须区分「增量模式」与「同步模式」，否则会锁死阶段 1/2

脚本用的是 `git diff --name-only ${FORK_DIFF_BASE}...HEAD`（三点）。同步分支从 `change/fork-foundation` 切出后 merge 上游，base 是 HEAD 的祖先，三点差集等于**全量上游改动**：

```
$ git diff --name-only e15e5b68 53b54d68 | wc -l
290
$ git diff --name-only e15e5b68 fe2957c8 | wc -l
800
```

这些文件绝大多数既不在 `src/fork/**` 也不在 allowlist 内，会被全部判越界——同步 PR 自己被 CI 拦死。所以必须分两种模式：

| 模式 | 基准                                           | 差集语义                | 用在哪                    |
| ---- | ---------------------------------------------- | ----------------------- | ------------------------- |
| 增量 | `origin/<base_ref>`                            | 本次 PR 自己改了什么    | 日常 `feat/*`、`fix/*` PR |
| 同步 | 本次 merge 进来的上游提交（推导 + 校验，见下） | fork 相对上游的自有改动 | `feat/upstream-sync-*` PR |

`fork-guard.yml` 按分支名分流：`feat/upstream-sync-*` 走同步模式，其余走增量模式。

同步模式的基准**推导出来再校验**，不读任何记录文件（避免「同步 PR 须先更新基线文件、CI 才能取到正确值」这种隐含时序），但也**不能简单取 `git rev-parse HEAD^2`**——那个写法在两个必须工作的上下文里都不成立：

- **CI 里取到的是 PR 分支 tip，不是上游提交。** `actions/checkout@v4` 在 `pull_request` 事件下检出的是 GitHub 合成的 `refs/pull/N/merge`，其两个父是（base 分支 tip、PR head tip），于是 `HEAD^2` = 同步分支 tip。基准取成分支 tip 后 `git diff <分支tip>...HEAD` 几乎为空 → **边界检查空转恒绿**。门禁看着过了其实一个文件没查，比全判红更难发现。
- **本地跑到门禁那步时 HEAD 早已不是合并提交。** 阶段 1/2 的门禁排在合并之后又提交了三到五节内容之后，此时 `HEAD^2` 直接 `fatal: ambiguous argument`。
- 长同步里中途 `git merge change/fork-foundation` 跟一次 base 也很常见，那之后第二父就变成了 base 分支 tip。

所以规则收紧为：

**推导** —— 取本分支上最近一个「第二父不是 base 分支祖先」的 merge 提交的第二父；也允许命令行显式 `FORK_SYNC_BASE=<sha>` 覆盖（值来自命令行而非记录文件，没有时序问题）。

**校验** —— 两条路径都必须过同一道机械检查：

```bash
git merge-base --is-ancestor $BASE HEAD             # 必须成立：基准是 HEAD 的祖先
git merge-base --is-ancestor $BASE origin/$BASE_REF # 必须不成立：基准不能是 base 分支上已有的提交
```

**推导失败或校验不过一律硬失败，绝不回落增量模式**——静默降级就是又一次空转恒绿。

`fork-guard.yml` 的 checkout 另加 `ref: ${{ github.event.pull_request.head.sha }}`（保留 `fetch-depth: 0`），让 HEAD 就是分支 tip，不必从合成 merge 绕一层。

`FORK_SCAN_ALL` 排查模式则读 `src/fork/identity/upstream-baseline.json` 的 `forkPointSha`——**绝不硬编码**，否则阶段 1 一合入基线就过期，阶段 2 的前置门禁会把 290 个上游文件全列成越界。该文件同时记 `lastSyncedSha` / `lastSyncedVersion` 供 `FORK.md` 对账与人工 diff 用。

### 决策 7：资源档 32 个分两路，29 个逐文件进 allowlist

本变更初稿写的是「都不进 allowlist」，理由是「它们早在 `main` 里，未来 PR 的 diff 不含它们」——这个判断**只在增量模式下成立**（实测 `FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs` 输出 `Fork boundary OK`）。决策 6b 引入同步模式后不再成立：同步模式的差集正是「fork 相对上游的自有改动」，这 29 个必然出现在里面，不登记就会让阶段 1/2 的同步 PR 判红。故改判：

- **3 个 fork 净新增**（`src/assets/icons/renyimiao.svg`、`assets/renyimiao-icon.svg`、`.gitattributes`）：迁到 `src/fork/assets/`，由既有 `src/fork/**` 规则自动放行；`.gitattributes` 补进脚本的 `FORK_ROOT_FILES` 集合。
- **29 个上游素材与配置替换**（`public/icon/*.png`、`assets/**`、`src/assets/demo/*.png`、`package.json`、`.env.example`）：**逐文件写进 allowlist 的 `files` 数组**。

**仍然拒绝前缀式放行**——写下 `src/assets/icons/` 之后，日后往该目录丢一个 `.ts` 会被静默放过，而 allowlist 的语义是「逐文件枚举 + 增项评审」。枚举保留了这个语义，前缀没有。逐条登记同时也让「哪天真要再换品牌图」这件事仍然经过一次评审。

阶段 2 会删除的上游文件（`src/entrypoints/partner-bridge.content/**` 与被上游重构删掉的 options 文件）同样会出现在同步模式差集里，需要对应的登记项。

### 决策 8：重定向只给「importer 在上游侧」的文件，并给每条记内容指纹

**不是每个搬进 fork 的模块都需要一条重定向。** 判据：只有当 importer 是上游文件、fork 改不到它的 import 语句时才需要重定向；如果消费方本来就是 fork 自己的模块（例如 `blog-notification` 当前由 `src/fork/ui/popup/App.tsx` 直接 import），搬进 fork 后改 import 即可。11 → 25 条会把每次同步的人工对账量与 `buildStart` 断言面同步放大，能省则省。

**`buildStart` 只断言路径存在、不比对内容**（`FORK.md` 已点名这个弱点）——上游改了被换皮文件的内容，构建照样绿，皮悄悄掉。光靠「每次同步逐条 `git diff`」的人工纪律兜不住 25 条 × 每次同步。

因此给每条重定向记一个内容指纹，`buildStart` 比对当前内容与记录值，对不上就硬失败并提示「上游改了此文件，对账后更新指纹」。人工对账降为兜底，机械检查成为主防线。

两个实现细节：

- **指纹存 fork 自有 JSON** `src/fork/identity/redirect-baseline.json`（以 `from` 路径为键），**不塞进 `wxt.config.ts`**——那是 allowlist 里冲突最频繁、每次同步都要手工解的文件，往里加 20+ 个每次同步都变的字段等于给它加冲突面。
- **算法用「LF 归一化后取 sha256」**，不用 `git hash-object` 或读 git 工作树——本仓 `.gitattributes` 是 `* text=auto eol=lf`，Windows 检出时工作树内容与 blob 不一致，会产生假失配。

### 决策 9：`main.tsx` 走重定向可行性未知，先做 spike

`src/fork/ui-redirect-plugin.ts` 的 `resolveId` 在 `!importer` 时直接 `return null`，而 `popup/main.tsx`、`sidepanel/main.tsx` 是 HTML 入口模块、不是被 import 的模块——现有 11 条重定向没有一条是入口模块。

搬迁这两个文件之前先做最小 spike 验证重定向能否命中入口模块。不成立就退回「上游 `main.tsx` 缩成 2 行壳 + 进 allowlist 走评审」，与已有的 `app.tsx` 壳形态一致——这是本仓已验证的做法，不是新发明。

### 决策 10：fork 专属 vitest 配置属于护栏基建，本段就要建

根 `vitest.config.ts` 只注册 `WxtVitest()` 与 `react()`，不加载 `wxt.config.ts` 的 `forkUiRedirectPlugin`——`FORK.md` 明写「重定向在 vitest 下不生效，上游原版测试会继续绿但测的是休眠代码」。而搬迁档的任务全是「先红后绿」，其中 provider 展示层等换皮项在这个环境下根本测不到真实解析：接上重定向不改变模块解析，测试不会因此转绿。

新建 `vitest.fork.config.ts`：`mergeConfig` 根配置后追加 `forkUiRedirectPlugin(FORK_UI_REDIRECTS)`，fork 测试用 `pnpm vitest run --config vitest.fork.config.ts src/fork`。

**根 `vitest.config.ts` 一个字不改，也不进 allowlist。** 全局注册会让上游自己的测试也解析到 fork 影子——`options/pages/api-providers/__tests__/providers-config.test.tsx`、`components/llm-providers/__tests__/feature-provider-selector-list.test.tsx` 会被换成 fork 版，`custom-actions/action-config-form/__tests__/beta-gating.test.tsx` 会被换成 fork **空组件**，`utils/host/__tests__/translate-text.test.tsx` 会被换成 fork 微软适配器。这些上游断言必然落空、`pnpm run test` 判红，而修它只能改或删上游测试文件——又成越界、又要扩 allowlist，正好抵消本变更在做的事。

新文件是仓根 fork 净新增，按 `.gitattributes` 的同一手法补进脚本的 `FORK_ROOT_FILES`。

## Risks / Trade-offs

**风险 1：视觉回退是用户可见的产品退步。** fork 当前皮肤（更大的圆角、更柔的阴影、统一的 `text-sm`）会全部消失，回到上游样式。缓解：这是用户已明确批准的取舍（「回退到上游视觉，后续 UI 重建走影子 fork ui」）；回退与重建之间的窗口期外观不一致，需产品侧知悉。

**风险 2：搬迁档可能漏掉隐性 fork 行为。** 29 个文件里有些改动很小（`side.content/index.tsx` 只改了 shadow host 名字加 `-overlay` 后缀），容易在回退时被当成噪声丢掉。缓解：每个搬迁档文件动手前先把 fork diff 完整贴进任务，搬完后用 `git diff <分叉点> -- <file>` 断言该上游文件已无差异，且 fork 侧有对应测试。

**风险 3：重定向数量翻倍，buildStart 断言变脆。** 约 25 条 `from` 路径，上游动任何一个都会让构建失败。缓解：这是刻意的——阶段 1/2 合并时正好靠它精确定位需要跟进的换皮。

**风险 4：`overlay-feature-preview.tsx` 是 fork 新增的 159 行组件，被三个 options 页引用。** 搬进 fork 后，三个上游 options 页要回退到用上游 demo 图。缓解：这三个页面在上游 v1.46.4 的 options 重构里已被大改，阶段 2 本就要重新处理；阶段 0 先老实回退，不做提前适配。

**回滚策略**：本变更全部落在一个 `fix/fork-ui-revert-upstream-visuals` 分支，未合入前随时 `git branch -D` 丢弃。合入后回滚 = 把 `change/fork-foundation` 重置到合并前的提交——**不要 revert merge commit**：revert 之后那些提交在分支上仍算已合并，后续 merge 不会把内容带回来，必须先 revert-the-revert，等于在「只 merge」不变量上开静默的洞。

## Open Questions

- `.changeset/` 下 5 个 fork 自造的 changeset：`FORK_GUIDE.md` §3 说「changeset 休眠不删」，指的是上游的；fork 自己造的这 5 个从未被 `changeset version` 消费，本设计按删除处理。若后续 fork 要恢复 changeset 流程，需另行决定。
