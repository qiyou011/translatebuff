## Why

阶段 0（`fork-ui-revert-upstream-visuals`）把冲突面压下去之后，这是三段式上游同步的第一段。选 v1.43.6（上游 `53b54d68`）作为落脚点，是因为它是**上游 options 页重构（#1997，292 文件 / 1.4 万行）落地之前的最后一个发版**——把 WXT 大版本升级和配置迁移单独吃掉，不和 options 重构搅在一起。

干跑证据（阶段 0 之前测得）：

```
$ git merge-tree --write-tree --name-only change/fork-foundation 53b54d68
冲突 5 个
$ git merge-tree --write-tree --name-only change/fork-foundation fe2957c8   # 直接到 v1.46.4
冲突 34 个
```

11 条换皮重定向的 `from` 路径在 v1.43.6 **全部还在**，上游云/商业化功能一个都还没出现（Built-in AI 分层、Jalapeno、Atlas、plan-badge 全在 v1.43.6 之后）。这一段的风险面因此只有依赖升级和配置迁移两项。

## What Changes

- 从 `change/fork-foundation` 切 `feat/upstream-sync-v1-43-6`，`git merge` 上游 `53b54d68`（只 merge，绝不 rebase/squash）
- **依赖升级**：WXT `0.20.27` → `0.21.1`（上游 #1971 已连带改了 `proxy-fetch.ts`、`edge-tts.ts`、`translation-queues.ts` 与 6 个测试文件）、`@read-frog/api-contract` `0.11.0` → `0.12.0`、`@read-frog/definitions` `0.3.5` → `0.4.0`
- **配置迁移**：schema `86` → `88`，带入上游 `v086-to-v087`、`v087-to-v088` 两个脚本
- **翻译引擎修复直接受益**：同源导航翻译闪烁（#1982）、图标字体连字被误译（#1986）、Firefox 代理请求头与请求体丢失（#1967）、Gemini 3.6 / 3.5-flash-lite 新模型（#1942）
- 冲突按 `FORK.md` 四分类解：A 类一律 take-theirs，B 类手工保留 fork 那几行，`pnpm-lock.yaml` 用 `pnpm install` 重生成

不改任何 fork 功能，不动会员/登录，不引入新的换皮重定向。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。本段是纯同步，不改变任何已有能力的规格行为；上游带入的引擎修复属既有能力的缺陷修复，不构成需求变更。

## Impact

- **阻塞依赖**：MUST 在 `fork-ui-revert-upstream-visuals` 合入 `change/fork-foundation` 并全绿之后才启动。未还债就合，冲突面回到 5 个里带 4 个越界文件。
- **`@read-frog/*` 契约漂移**：升版本前 MUST diff 其常量（`AUTH_BASE_PATH` / `ORPC_PREFIX` / `AUTH_COOKIE_PATTERNS` / orpc 形状），fork 的会员与登录链路依赖它们。
- **WXT 0.21 是构建工具大版本**：三浏览器构建与 `scripts/pack.mjs` 两条打包轨都要复验，manifest 产出（4 段 version、`gecko.id`、`artifactTemplate`）尤其要逐项比对。
- **换皮重定向**：11 条 `from` 路径在本段全部存活，`buildStart` 断言不应报错；一旦报错说明落脚点选错了。
- **不涉及**：上游云/商业化功能在本段尚未出现，影子功能处理全部留到阶段 2。
