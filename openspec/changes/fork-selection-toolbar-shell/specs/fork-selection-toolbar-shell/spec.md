## ADDED Requirements

### Requirement: 翻译浮窗以 fork 壳承载

`[UI层]` 翻译浮窗（`selection.content`）MUST 经 re-export shim 由 `src/fork/ui/selection-content/` 下的 fork 壳承载 UI 组合与编排；注入层 `index.tsx`（shadow-host / 选区检测 / 定位）MUST 零改动、全留上游。复刻现状视觉——本次 MUST NOT 重设计 UI。

#### Scenario: shim + fork 壳挂载

- **GIVEN** `selection.content/index.tsx` 以 `<App uiContainer portalContainer />` 挂载
- **WHEN** 构建后运行
- **THEN** `selection.content/app.tsx` MUST 仅为 `export { default } from "@/fork/ui/selection-content/App"` 的 shim（保持 `{ uiContainer, portalContainer }` 默认导出签名）
- **AND** `index.tsx` 的 `import App from "./app"` 与挂载调用 MUST 零改动
- **AND** fork 壳树 MUST 为 `ToastProvider → Fork 翻译 Provider → Fork 自定义动作 Provider → Fork 药丸 Toolbar`

#### Scenario: 功能与现状对等

- **WHEN** 用户选中文字并操作工具栏
- **THEN** 以下 MUST 全部工作且视觉与现状一致：翻译（LLM 流式 + 标准 provider 两路径）、目标语言选择、模型/provider 下拉、重生成、朗读、复制、自定义动作执行、错误 Alert、右键菜单 / 快捷键触发

### Requirement: 复用上游引擎与机制

`[API层]` fork 壳 MUST 通过 import 复用上游翻译/动作引擎原语与选区/定位/shadow-host 机制与叶子组件；MUST NOT 重写引擎核心、MUST NOT 原地改上游 `provider.tsx` 或注入层。

#### Scenario: 引擎/机制 import 复用

- **WHEN** fork 壳发起翻译
- **THEN** MUST 复用上游 `background-stream-client` 端口流（`streamText` / `streamStructuredObject`）、`translateTextCore`、`provider-registry`、`atoms.ts`、config atoms、`positioning.ts` / `modal-dialog-host.ts` / shadow-host
- **AND** 叶子组件（`TranslationContent` / `SelectionToolbarFooterContent` / `Title` / `ErrorAlert` / `target-language-selector`）MUST import 上游（`provider-selector` 已 fork 重定向）

#### Scenario: controller hook 镜像隔离漂移

- **GIVEN** 上游 Provider 的编排状态机必须复制（context 只暴露 `prepareToolbarOpen`、状态不外露）
- **THEN** 编排 glue MUST 落 `use-*-controller.ts`、**逐行镜像**上游 provider body 并 `return` 全部态 + handlers；薄 Provider 壳只组合 popover JSX——使同步 diff 面集中于 controller

### Requirement: 三元组绑定不变量

`[UI层]` fork Provider、承载它的 Toolbar、消费其 context 的触发按钮（`TranslateButton` / `CustomActionTrigger`）MUST 同为 fork 版、共用 fork 自建 context；MUST NOT 跨 fork/上游 context 混用（上游 context 为 module-private，混用运行时抛 `"must be used within Provider"`）。

#### Scenario: context 身份一致

- **WHEN** 药丸按钮触发 Provider
- **THEN** 所有 context 消费者 MUST 读 fork context
- **AND** MUST NOT 出现任一按钮/Toolbar 仍 import 上游版而读上游 context 的运行时崩溃

### Requirement: 彻底省略 notebase 与猜你想存

`[UI层][API层]` fork 壳 MUST NOT 渲染 `SaveSuggestionCard` / `SaveToNotebaseButton` / `SaveToNotebaseDialogHost`、MUST NOT import `useSaveSuggestion` 或 `isSaveToNotebaseDialogOpenAtom`，使后台 AI 建议请求不再发出（比 redirect 空组件更彻底）。

#### Scenario: 视觉与请求双省略

- **WHEN** 翻译浮窗/动作浮窗渲染
- **THEN** 翻译浮窗 MUST NOT 出现「猜你想存」卡、动作浮窗 MUST NOT 出现「保存到笔记库」
- **AND** 翻译时 MUST NOT 发出 `streamNoteSuggestion` 请求
- **AND** `disablePointerDismissal` MUST 省略或恒 `false`（不保留对 `save-to-notebase-dialog-atom` 的 import）

#### Scenario: 退役与保留的重定向

- **WHEN** 处理现有 `FORK_UI_REDIRECTS`
- **THEN** MUST 撤除 `save-suggestion-card` 浮窗重定向条目并删除其 fork 空组件（壳内不渲染即可）
- **AND** MUST 保留选项页 `save-suggestion-toggle` 重定向（该开关在选项页、非浮窗，功能已省故继续隐藏）

### Requirement: 软 fork 边界合规

`[约束]` 净新增 MUST 全在 `src/fork/ui/selection-content/**`；原地改仅限已 allowlist 的 `selection.content/app.tsx` + `wxt.config.ts`；`selection.content/index.tsx` MUST 从 allowlist 移除且本次零改动；MUST NOT 触红线。

#### Scenario: 边界与红线校验

- **WHEN** 运行 fork 边界校验
- **THEN** MUST 无 `src/fork/**` + 已 allowlist 文件之外的改动
- **AND** 从 allowlist 移除 `selection.content/index.tsx` 后校验 MUST 仍绿（该文件零改动）
- **AND** MUST NOT 改动 config zod schema / `DEFAULT_CONFIG` / migration / `providers.ts` / `models.ts` / `message.ts`
