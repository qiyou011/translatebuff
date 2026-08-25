## Context

fork 与上游共享 git 祖先，分叉点 `e15e5b68`（v1.42.2）。落后 120 提交、22 个版本。`FORK.md` 已定义好同步仪式（只 merge、A 类 take-theirs、lockfile 重生成、三浏览器构建门），本段是照着仪式跑一次，落脚点选在 `53b54d68`（v1.43.6）。

选这个点的依据：

| 指标              | v1.43.6          | v1.46.4          |
| ----------------- | ---------------- | ---------------- |
| 干跑冲突          | 5                | 34               |
| 换皮重定向存活    | 11 / 11          | 7 / 11           |
| 配置 schema       | 86 → 88          | 86 → 99          |
| WXT               | 0.20.27 → 0.21.1 | 0.20.27 → 0.21.4 |
| 上游云/商业化功能 | 0 个             | 4 块             |

## Goals / Non-Goals

**Goals:**

- 把上游 v1.42.2 → v1.43.6 的引擎改进与依赖升级合进 fork，全绿并发一次内测包
- 把 WXT 0.21 大版本升级的风险单独隔离在这一段，不与 options 重构叠加
- 为阶段 2 留下一个已验证的中间基线：出问题能二分到这一段还是下一段

**Non-Goals:**

- 不处理上游 options 页重构（阶段 2）
- 不处理任何上游云/商业化功能——本段范围内它们还不存在
- 不新增、不迁移换皮重定向
- 不改 fork 自有功能（会员、登录、provider、品牌）

## Decisions

### 决策 1：落脚点取 `53b54d68` 而非某个整数版本号

`53b54d68` 是 `chore(release): version packages (#1987)`，即 options 重构 `9009c67e`（#1997，2026-07-30）之前的最后一个 release 提交。取 release 提交而不是任意提交，是为了让落脚点与上游的发版语义对齐——`package.json` version、CHANGELOG、changeset 目录三者在 release 提交上是自洽的，中途某个提交上不是。

### 决策 2：WXT 升级不做任何 fork 侧适配，先看上游怎么改的

上游 `64a3462d`（#1971）升 WXT 时连带改了 `proxy-fetch.ts`、`edge-tts.ts`、`translation-queues.ts`、`scrape-ai-sdk-provider-models.ts` 与 6 个测试。这些全是 D 类（引擎），merge 自动带入。fork 侧唯一可能受影响的是 `wxt.config.ts`（B 类，fork 改了 138 行）——manifest 生成、`artifactTemplate`、Firefox `gecko.id`、fork 版本号注入都在里面。

处理方式：`wxt.config.ts` 冲突手工解，**解完必须逐项比对产物 manifest**，而不是只看构建绿。构建绿只证明 WXT 能跑，证明不了 4 段版本号和 `gecko.id` 还在。

### 决策 3：`pnpm-lock.yaml` 一律 `pnpm install` 重生成

上游 #1971 的 lockfile 改了 981 行。手工合并 lockfile 是已知的踩坑源，`FORK.md` 已列为不变量。冲突时直接 `git checkout --theirs pnpm-lock.yaml` 后跑 `pnpm install`，让它按合并后的 `package.json` 重算。

### 决策 4：`@read-frog/*` 升版前先 diff 契约常量

`api-contract` `0.11.0` → `0.12.0`、`definitions` `0.3.5` → `0.4.0`。fork 的会员与登录走 better-auth + orpc，依赖 `AUTH_BASE_PATH`、`ORPC_PREFIX`、`AUTH_COOKIE_PATTERNS` 与 orpc 路由形状。这四项任一变化都会让 fork 后端对不上，且是运行时才暴露、测试测不出来的那种。

升级动作里显式插一步：在 `node_modules/@read-frog/definitions` 下 diff 新旧两版这几个常量，把 diff 结果贴进 PR。

### 决策 5：边界检查在同步分支上必须走同步模式

`check-fork-boundary.mjs` 用三点 diff。同步分支从 `change/fork-foundation` 切出后 merge 上游，base 是 HEAD 的祖先，`FORK_DIFF_BASE=origin/change/fork-foundation` 的差集等于**全量上游改动**（本段 290 个文件），会把同步 PR 自己判红。

必须走阶段 0 引入的同步模式：基准推导为本次 merge 进来的 `53b54d68` 并过两条校验（是 HEAD 祖先、且不是 base 分支上已有的提交），差集语义变成「fork 相对上游的自有改动」。`fork-guard.yml` 已按分支名 `feat/upstream-sync-*` 自动分流；本地手跑带 `FORK_SYNC_MODE=1`，若门禁那步 HEAD 已不是合并提交，显式给 `FORK_SYNC_BASE=53b54d68`。

### 决策 6：换皮指纹必然失配，对账是必经步骤而不是意外

阶段 0 给每条重定向加了内容指纹，`buildStart` 失配即硬失败。本段区间内**有 4 条重定向的 `from` 被上游改过**：

```
$ git diff --name-only e15e5b68 53b54d68 -- <11 条 from 路径>
src/utils/host/translate/api/microsoft.ts
src/entrypoints/options/pages/api-providers/providers-config.tsx
src/entrypoints/options/pages/selection-toolbar/selection-toolbar-save-suggestion-toggle.tsx
src/components/llm-providers/feature-provider-selector-list.tsx
```

所以合并后构建**一定会因指纹失配而红**，这是预期行为、不是故障。危险在于实施者图省事直接刷新指纹——`microsoft.ts` 正是 `FORK.md` 点名的「上游改动频率最高、漏看必出功能问题」那条，静默吞掉它的上游改动恰恰是这套机制要防的事。

因此本段把「换皮对账」列为独立一节，且顺序固定：**先 diff、先判断、再更新指纹**。

### 决策 7：合并后先跑漂移哨兵，再跑常规门禁

`src/fork/providers/__tests__/upstream-decode-drift.test.ts` 是 `FORK.md` 点名的哨兵：它变红意味着上游把 `microsoft-translate` 加进了 `normalizeTranslationOutput` 的解码集合，此时必须删掉 fork 适配器里的 `decodeHTMLStrict`，否则双重解码会把 `&amp;` 静默塌成 `&`——不冲突、不报错、极难查。

这条要在门禁序列的最前面跑，别等三浏览器构建跑完 20 分钟才发现。

## Risks / Trade-offs

**风险 1：`wxt.config.ts` 冲突解错，fork 身份悄悄丢失。** fork 在这个文件里改了 138 行（4 段版本号、`gecko.id`、`artifactTemplate`、渠道号后缀、`FORK_UI_REDIRECTS`），上游改了 25 行。手工解冲突时漏保留某一行，构建照样绿但产物身份错了。缓解：`node scripts/assert-fork-build.mjs` 断言 fork 域名进产物；额外人工比对 `.output/*/manifest.json` 的 `name` / `version` / `version_name` / `browser_specific_settings`。

**风险 2：WXT 0.21 的行为变化在运行时才暴露。** 构建工具升级最典型的坑是 content script 注入时机、shadow DOM 挂载、HMR 行为变了，而单元测试跑在 jsdom 里测不出来。缓解：合并后必须装真包做人工冒烟——网页翻译、划词翻译、字幕、popup、options 五条路径全走一遍。

**风险 3：配置迁移把存量用户配置改坏。** v086→v088 两个脚本由上游提供，但 fork 有独立的 `src/fork/config/` 迁移链，两条链在同一次启动里都会跑。缓解：拿一份真实的存量配置（从测试包导出）跑一次迁移，比对迁移前后的 `providersConfig` 与 fork 侧 `membership` 字段。

**回滚策略**：整段落在 `feat/upstream-sync-v1-43-6` 分支，PR 合入 `change/fork-foundation` 之前随时丢弃。

合入后的回滚方式是**把 `change/fork-foundation` 重置到合并前的提交**，MUST NOT 用 `git revert` 掉 merge commit——revert 之后上游那些提交在分支上仍算已合并，下次 `git merge upstream` 不会把内容带回来，必须先 revert-the-revert。这是在「只 merge、绝不改写历史」不变量上开的静默洞。若因协作原因只能 revert，MUST 在 `FORK.md` 记录该 revert commit 与 revert-the-revert 流程。

另需注意：配置迁移是**单向**的，回滚代码回滚不了已迁移的用户配置。真正无副作用的回滚窗口只在内测包发出之前。

## Open Questions

- 内测包发给谁、验多久才算过。当前假设是发一版 `node scripts/pack.mjs test`，由用户本人人工验收后再启动阶段 2。
