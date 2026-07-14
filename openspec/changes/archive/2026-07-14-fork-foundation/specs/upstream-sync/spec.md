## ADDED Requirements

### Requirement: 上游 remote 与共享祖先不变量

系统 SHALL 配置指向 `mengxi-ream/read-frog` 的 `upstream` git remote，并 MUST 保持 `main` 与 `upstream/main` 的共享提交祖先——绝不对 `main` 上的上游提交做 rebase 或 squash。

#### Scenario: 添加 upstream remote 并验证共享祖先

- **WHEN** 执行 `git remote add upstream https://github.com/mengxi-ream/read-frog.git` 后运行 `git merge-base --is-ancestor upstream/main main`
- **THEN** 命令退出码为 0（共享祖先成立），`git remote -v` 同时列出 `origin`(qiyou011/translatebuff) 与 `upstream`(mengxi-ream/read-frog)

#### Scenario: 拒绝破坏共享祖先的历史改写

- **WHEN** 有人尝试对 `main` 已有的上游提交执行 rebase 或 squash
- **THEN** 该操作被 `FORK.md` 与团队约定禁止；同步一律通过 merge 完成，保留稳定的上游提交 SHA

### Requirement: merge-only 同步仪式

系统 SHALL 定义一套只用 `git merge` 的同步流程：在 `sync/<date>` 分支上合并 `upstream/main`，用 `pnpm install` 重新生成 `pnpm-lock.yaml`（绝不手工合并），并要求测试与三浏览器构建全绿后才 PR 入 `main`。

#### Scenario: 执行一次上游同步

- **WHEN** 运行 `git fetch upstream && git switch -c sync/<date> main && git merge upstream/main`，随后 `pnpm install`、`pnpm run test`、`wxt build`(chrome/edge/firefox)
- **THEN** 冲突仅出现在 allowlist 内文件；lockfile 由 `pnpm install` 重新生成；全部检查通过后方可合入 `main`

#### Scenario: 启用 rerere 记忆冲突解法

- **WHEN** 完成 `git config rerere.enabled true`
- **THEN** `git config --get rerere.enabled` 返回 `true`，重复冲突解法在后续同步被自动复用

### Requirement: 同步仪式落盘文档

系统 SHALL 在仓库根提供 `FORK.md`，记录同步仪式、take-theirs 热点清单与 merge-only 不变量，作为 fork 的权威操作手册。

#### Scenario: FORK.md 存在且包含核心规则

- **WHEN** 打开 `FORK.md`
- **THEN** 文档包含同步步骤、"NEVER edit（take-theirs）"热点清单、以及"merge only，绝不 rebase/squash main"的不变量
