## Why

翻译浮窗（`selection.content` 的选区工具栏 + 「Translation」结果浮窗）目前靠「在共享 `app.tsx` 原地改 + 逐个 redirect 隐藏上游功能」维持。最近一次同步上游就在 `app.tsx` / toast 上正面冲突（fork 曾改名共享组件 frog-toast→brand-toast），暴露了软 fork 的结构弱点：**重度定制的整块 surface 不该原地改、逐块 redirect**。同时 notebase / 猜你想存靠 redirect 只藏了视觉——后台 `useSaveSuggestion` 的 AI 请求仍在跑、白耗配额。

需要把翻译浮窗升级为「re-export shim + fork 壳」（对齐 popup 已验证模式）：fork 拥有 UI 组合、复用上游翻译引擎与机制，彻底省略 notebase / 猜你想存，为后续 UI 重设计铺路。

## What Changes

- **入口 shim**：`selection.content/app.tsx` 缩为 re-export shim 指向 fork 壳；`index.tsx` 注入层零改动（shadow-host / 选区检测 / 定位全留上游）。
- **fork 壳树**：新建 fork 版三元组（翻译 Provider / 自定义动作 Provider / 药丸 Toolbar），拥有 popover JSX 组合，复用上游引擎原语、机制模块、叶子组件（import）。
- **引擎两层拆分**：编排状态机逐行镜像进 controller hook（集中漂移面、便于同步 diff）；薄 Provider 壳组合 JSX + fork 自建 context。
- **省略上游功能**：fork 壳不 import `useSaveSuggestion`、不渲染 `SaveSuggestionCard` / `SaveToNotebaseButton` / `SaveToNotebaseDialogHost`——连 AI 请求都不发（比 redirect 空组件彻底）。
- **退役重定向**：撤 `save-suggestion-card` 浮窗重定向（壳内不渲染即可）；保留选项页 `save-suggestion-toggle` 重定向。
- **allowlist 卫生**：`selection.content/index.tsx` 从白名单移除（本次确认零改动）。
- **本次只复刻现状 UI**（视觉不变），重设计留作壳上的后续变更。

## Capabilities

### New Capabilities

- `fork-selection-toolbar-shell`: 翻译浮窗以「re-export shim + fork 壳」承载 UI 组合，复用上游翻译/动作引擎与选区/定位/shadow-host 机制，彻底省略 notebase/猜你想存，功能与现状对等，为重设计铺路。

### Modified Capabilities

- （无。复用上游引擎、不改其行为；上游功能的隐藏机制从「构建期 redirect 空组件」升级为「fork 壳内不渲染」，不改上游任何 spec 级行为。）

## Impact

- 代码（净新增全在 `src/fork/ui/selection-content/**`；仅碰 2 个已 allowlist 文件 + `wxt.config`；无红线）：
  - 新建 `src/fork/ui/selection-content/**`（App 壳 + 三元组 fork 壳 + controller hooks）
  - 改 `selection.content/app.tsx`（shim）；`index.tsx` 零改动、并从 allowlist 移除
  - 改 `wxt.config`（退役 `save-suggestion-card` 重定向）；删已退役的 fork 空组件 `src/fork/ui/selection-toolbar/save-suggestion-card.tsx`
- **复制/漂移代价**（深层 fork 固有）：fork 复制翻译/动作 Provider 编排 glue → 上游对**编排逻辑**的改进需每次同步 diff 上游 `provider.tsx` + `app.tsx` 手工跟；核心引擎原语（流式/provider 解析/config）仍 import、自动同步。
- 测试参考：controller hook 复用上游引擎（翻译 LLM+标准 / 取消 / 重生成）· fork 壳渲染（功能对等、notebase/猜你想存不出现）· 边界（无越界、无红线、index.tsx 移除后仍绿）· 三构建 + `assert-fork-build` + `check-fork-brand` · 实机（功能对等、零浪费 AI 请求）
