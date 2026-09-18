## MODIFIED Requirements

### Requirement: merge-only 同步仪式

系统 SHALL 定义一套完整同步只用 `git merge` 的流程：在 `sync/<date>` 分支上合并 `upstream/main`，用 `pnpm install` 重新生成 `pnpm-lock.yaml`（绝不手工合并），并要求测试与三浏览器构建全绿后才 PR 入 `main`。本期允许按 selective-upstream-patches 规格选择性移植已批准的 12 条修复；该操作 MUST 不宣称完成完整同步，不改写共享历史，不推进 lastSyncedSha 或 lastSyncedVersion。

#### Scenario: 执行一次上游同步

- **WHEN** 运行 `git fetch upstream && git switch -c sync/<date> main && git merge upstream/main`，随后 `pnpm install`、`pnpm run test`、`wxt build`(chrome/edge/firefox)
- **THEN** 冲突仅出现在 allowlist 内文件；lockfile 由 `pnpm install` 重新生成；全部检查通过后方可合入 `main`；已纳入完整同步的选择性来源须清理，最终账本预检通过

#### Scenario: 启用 rerere 记忆冲突解法

- **WHEN** 完成 `git config rerere.enabled true`
- **THEN** `git config --get rerere.enabled` 返回 `true`，重复冲突解法在后续同步被自动复用

#### Scenario: 本期选择性移植

- **WHEN** 移植本期选定修复而未执行完整 merge
- **THEN** 使用经审查的补丁与文件级多来源账本，完整同步基线保持 `02ad422c1e1260960e141e4012a20d93e85082aa` 和 `1.46.6`，保留任译喵会员、网关、批处理及云隔离契约
