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
7. `node scripts/assert-fork-build.mjs` 必须通过（产物内无 readfrog 域名）
8. 开 PR：sync/* -> main

## 绝不编辑（每次同步 take-theirs）

- src/utils/message.ts（ProtocolMap）
- src/types/config/* schema、src/utils/constants/config.ts DEFAULT_CONFIG
- src/utils/config/migration-scripts/*
- src/utils/constants/models.ts、src/utils/constants/providers.ts
- package.json `version`、CHANGELOG.md、pnpm-lock.yaml

## 唯一允许原地编辑的上游文件

见 scripts/fork-allowlist.json。向其增项需评审。

## 不变量

- 只 merge，绝不 rebase/squash main 上的上游提交（否则毁掉便宜三方合并的共享祖先）。
- 所有净新增代码进 src/fork/**。
- fork 配置使用独立 storage key + schema + 迁移链；绝不触碰上游 configSchema。
