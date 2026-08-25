## MODIFIED Requirements

### Requirement: merge-only 同步仪式

系统 SHALL 定义一套只用 `git merge` 的同步流程：在同步分支上合并上游目标提交，用 `pnpm install` 重新生成 `pnpm-lock.yaml`（绝不手工合并），并要求测试与三浏览器构建全绿后才 PR 入长期分支。

同步分支 SHALL 命名为 `feat/upstream-sync-<目标版本>`，从 `change/fork-foundation` 切出，并以 PR 形式合回 `change/fork-foundation`——MUST NOT 由本地 `git merge` 直接推入长期分支。

落脚点 SHALL 选择上游的 `chore(release): version packages` 提交，MUST NOT 停在两次 release 之间的任意提交——只有 release 提交上 `package.json` version、`CHANGELOG.md` 与 `.changeset/` 三者才是自洽的。

跨越上游大规模重构（单次改动超过 200 个文件）时，同步 SHALL 拆成多段，每段独立验收；MUST NOT 把重构与依赖大版本升级合并在同一次同步里。

#### Scenario: 执行一次上游同步

- **WHEN** 运行 `git switch -c feat/upstream-sync-<版本> change/fork-foundation && git merge <上游release提交>`，随后 `pnpm install`、`pnpm run test`、`wxt build`(chrome/edge/firefox)
- **THEN** 冲突仅出现在 allowlist 内文件；lockfile 由 `pnpm install` 重新生成；全部检查通过后方可 PR 合入 `change/fork-foundation`

#### Scenario: 启用 rerere 记忆冲突解法

- **WHEN** 完成 `git config rerere.enabled true`
- **THEN** `git config --get rerere.enabled` 返回 `true`，重复冲突解法在后续同步被自动复用

#### Scenario: 落脚点必须是 release 提交

- **GIVEN** `[数据层]` 候选落脚点 `53b54d68` 的提交信息为 `chore(release): version packages (#1987)`
- **WHEN** 选定该提交为同步目标
- **THEN** 合并后 `package.json` 的 `version` 与 `CHANGELOG.md` 顶部条目一致

## ADDED Requirements

### Requirement: 同步前置门禁

启动任一段上游同步前，边界扫描 MUST 无源码级越界（`.ts`/`.tsx`/`.css`），否则同步 MUST 中止。带着未清理的原地改动合并上游，会把可避免的冲突重复计入每一次同步。

#### Scenario: 存量越界时拒绝启动同步

- **GIVEN** `[数据层]` `FORK_SCAN_ALL=1 node scripts/check-fork-boundary.mjs` 的输出包含 `.tsx` 条目
- **WHEN** 有人尝试开启同步分支
- **THEN** 同步 MUST 中止，先完成越界清理

### Requirement: 同步后契约漂移检查

同步涉及 `@read-frog/api-contract` 或 `@read-frog/definitions` 版本变化时，MUST 在合入前 diff 其 `AUTH_BASE_PATH`、`ORPC_PREFIX`、`AUTH_COOKIE_PATTERNS` 与 orpc 路由形状，并把 diff 结果记入 PR。这些常量的变化不产生 merge 冲突、不使测试变红，只在运行时让 fork 后端对不上。

#### Scenario: 契约常量变化被记录

- **GIVEN** `[数据层]` `@read-frog/definitions` 从 `0.3.5` 升到 `0.4.0`
- **WHEN** 执行同步
- **THEN** PR 描述中包含这四项常量的新旧对比；无变化时也 MUST 明确写出「无变化」

#### Scenario: 解码漂移哨兵优先于构建门

- **WHEN** 合并完成
- **THEN** `src/fork/providers/__tests__/upstream-decode-drift.test.ts` MUST 在三浏览器构建之前运行；该测试变红时 MUST 先删除 fork 微软适配器里的 `decodeHTMLStrict` 再继续
