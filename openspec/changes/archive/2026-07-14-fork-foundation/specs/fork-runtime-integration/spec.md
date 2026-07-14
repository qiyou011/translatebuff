## ADDED Requirements

### Requirement: 独立 fork 消息通道

系统 SHALL 提供一个独立于上游 `ProtocolMap` 的 fork 消息通道（独立的 `defineExtensionMessaging<ForkProtocolMap>()`），fork 新增消息只进该通道，绝不编辑上游 `src/utils/message.ts`。

#### Scenario: fork 消息不污染上游 ProtocolMap

- **WHEN** 新增 fork 后台消息
- **THEN** 消息定义位于 `src/fork/message.ts` 的 `ForkProtocolMap`，上游 `src/utils/message.ts` 未被修改

### Requirement: 单行后台接线

系统 SHALL 通过一个 `setupFork()` 函数集中 fork 所有后台接线，并仅以单行调用接入上游 `src/entrypoints/background/index.ts` 的 `main`，把该上游文件的冲突面压到一行。

#### Scenario: setupFork 单行接入

- **WHEN** 检视 `src/entrypoints/background/index.ts`
- **THEN** 其对 fork 的改动仅为一个 import 与 `main` 内的一行 `setupFork()` 调用；fork 后台逻辑实现在 `src/fork/background/index.ts`

#### Scenario: 接线后可构建

- **WHEN** 接入 `setupFork()` 后执行 `pnpm run build`
- **THEN** 构建成功，background service worker 正常加载

### Requirement: app.tsx 壳层 UI 承载

系统 SHALL 通过把上游入口 `app.tsx` 缩减为 re-export fork 屏幕的壳层来承载 fork UI；fork 屏幕只消费 atoms（读态）与 `sendMessage`/ProtocolMap（触发引擎），不直接读取上游 zod 配置 schema。

#### Scenario: popup 参考页经壳层承载 fork UI

- **WHEN** 构建后加载扩展并打开 popup
- **THEN** popup 渲染 `src/fork/ui/popup/App` 的 fork 界面；上游 `src/entrypoints/popup/app.tsx` 仅为 re-export 壳层
