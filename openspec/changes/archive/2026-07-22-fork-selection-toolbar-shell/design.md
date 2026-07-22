## Context

翻译浮窗 = `selection.content` surface，三层结构：

- **注入层** `selection.content/index.tsx`：`defineContentScript` + `createShadowRootUi`（shadow-host）+ 选区检测（mouseup/selectionchange）+ 定位（`positioning.ts` / `modal-dialog-host.ts`）。纯机制、重 DOM/几何。
- **编排层** `selection.content/app.tsx`：`ToastProvider → SelectionTranslationProvider → SelectionCustomActionProvider → SelectionToolbar`，签名 `{ uiContainer: HTMLElement; portalContainer: ShadowRoot }`，`index.tsx:73` 以 `<App uiContainer portalContainer />` 挂载。
- **Provider 内**：翻译/动作的**引擎函数 + React `useState` 状态 + popover JSX 焊在一起**（`translate-button/provider.tsx` 799 行、`custom-action-button/provider.tsx` 442 行）。

**决定架构的关键约束**：`SelectionTranslationContext`（`translate-button/provider.tsx:238-242`）是 **module-private（未导出）const**，只暴露 `{ prepareToolbarOpen }`。13 个翻译态（`translatedText/thinking/error/isTranslating/anchor/isOpen/popoverSessionKey…`，`:260-273`）是 Provider 内 `useState`，popover JSX（`:745-797`）在 Provider 内层直接消费本地 state。→ **要写自己的 popover JSX，就必须 fork 整个 Provider**（thin-via-context 不可行）。

notebase「保存到笔记库」在自定义动作 Provider 内、「猜你想存」save-suggestion 在翻译 Provider 内；二者与翻译核心零依赖，唯一触点是无害的 `disablePointerDismissal={isSaveToNotebaseDialogOpen}`（notebase 切除后该 atom 无写入方、恒 false）。

## Goals / Non-Goals

**Goals:**

- 翻译浮窗以「re-export shim + fork 壳」承载 UI 组合（对齐 popup），fork 拥有 popover JSX 与编排。
- 复用上游翻译/动作引擎原语 + 选区/定位/shadow-host 机制 + 叶子组件（import）。
- 彻底省略 notebase/猜你想存（不渲染 + 不 import hook，连 AI 请求都不发）。
- 退役 `save-suggestion-card` 浮窗重定向；`selection.content/index.tsx` 出 allowlist。
- 复刻现状视觉、功能对等。

**Non-Goals:**

- 不重设计 UI（留作壳上的后续变更）。
- 不改上游 `provider.tsx` / 引擎 / config schema / 注入层 `index.tsx`。
- 不动 `side.content`（悬浮球，另一 surface）。
- 不清理 allowlist 其余 cruft（`sidepanel/app.tsx` / `side.content/app.tsx` / `auth/*` / `orpc/*`，另开小卫生变更）。

## 文件结构

**新建 `src/fork/ui/selection-content/`（C 类，零冲突）：**

| 文件                                              | 职责                                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`                                         | fork 壳根：`ToastProvider → ForkSelectionTranslationProvider → ForkSelectionCustomActionProvider → ForkSelectionToolbar`。签名 `{ uiContainer, portalContainer }`，`export default`。 |
| `context.ts`                                      | fork 自建 `SelectionTranslationContext` / `SelectionCustomActionContext`（fork 拥有，消费者只在 fork 内）                                                                             |
| `use-selection-translation-controller.ts`         | **逐行镜像**上游 translate provider body（`provider.tsx:260-736`），`return` 全部态 + handlers；**省略 save-suggestion 相关行**（`:296-318,541,602,610,779-783`）                     |
| `SelectionTranslationProvider.tsx`                | 薄壳：调 controller → 供 fork context + 组合翻译 popover JSX（`:745-797` 的组合，去 `SaveSuggestionCard`）                                                                            |
| `use-custom-action-controller.ts`                 | 逐行镜像上游 custom-action provider body                                                                                                                                              |
| `SelectionCustomActionProvider.tsx`               | 薄壳：调 controller → fork context + 组合动作 popover JSX（去 `SaveToNotebaseButton` / `SaveToNotebaseDialogHost`）                                                                   |
| `SelectionToolbar.tsx`                            | fork 药丸：import 上游检测/定位机制，重写药丸 JSX（translate/speak/custom-action/close）                                                                                              |
| `TranslateButton.tsx` / `CustomActionTrigger.tsx` | fork 版触发按钮（消费 fork context，见 D4）                                                                                                                                           |

**改（已 allowlist）：**

- `selection.content/app.tsx` → shim：`export { default } from "@/fork/ui/selection-content/App"`
- `wxt.config.ts` → 退役 `save-suggestion-card` 重定向条目
- `scripts/fork-allowlist.json` → 移除 `src/entrypoints/selection.content/index.tsx`

**删：**

- `src/fork/ui/selection-toolbar/save-suggestion-card.tsx`（退役的 fork 空组件）

## Decisions

### D1 shim 契约

`app.tsx` 保持 `export default`、签名 `{ uiContainer, portalContainer }`；`index.tsx:27` 的 `import App from "./app"` 与 `:73` 挂载**零改动**——故 `index.tsx` 不进 allowlist。

### D2 复用边界

- **留上游、直接 import（D 类、自动同步）**：注入层 `index.tsx`、选区检测、`positioning.ts`、`modal-dialog-host.ts`、shadow-host、`atoms.ts`、`background-stream-client`（`streamText`/`streamStructuredObject` 端口）、`provider-registry`、config atoms（`configFieldsAtomMap`/`writeConfigAtom`）、`translateTextCore`、叶子组件（`TranslationContent`/`SelectionToolbarFooterContent`/`SelectionToolbarTitleContent`/`SelectionToolbarErrorAlert`/`target-language-selector`；`provider-selector` 已 fork 重定向）。
- **fork 复制（C 类）**：3 个 Provider/Toolbar 的编排 glue（state + run 状态机 + cancel/session-key + handlers）+ popover JSX 组合 + 2 个触发按钮。

### D3 两层拆分（漂移的架构级缓解）

不把「状态机 + fork JSX」混在一个文件。controller hook **逐行镜像**上游 provider body（结构 1:1，同步时 `diff 上游 provider.tsx → 搬 delta 到镜像 hook` 是机械低认知操作）；薄 Provider 壳只组合 JSX。将来重设计只动 JSX 壳、**不污染同步 diff 面**。

### D4 三元组绑定不变量（必守，否则运行时崩）

fork 自建 context 后，其消费者 `TranslateButton` / `CustomActionTrigger` 及承载它们的 `SelectionToolbar` **必须随 Provider 一起 fork，任一不可留上游 import**。因上游 context 是 module-private——若 fork Provider 供 fork context、而某按钮仍 import 上游按钮读上游 context，运行时抛 `"must be used within Provider"`。**三元组（Provider + Toolbar + 触发按钮）同进同出。**

### D5 省略 notebase / save-suggestion

fork 壳**不 import** `useSaveSuggestion` / `isSaveToNotebaseDialogOpenAtom`，**不渲染** `SaveSuggestionCard` / `SaveToNotebaseButton` / `SaveToNotebaseDialogHost`——连 `streamNoteSuggestion` AI 请求都不发。`disablePointerDismissal` 直接省略或写常量 `false`（不为已切功能保留对 `save-to-notebase-dialog-atom` 的 import）。退役 `save-suggestion-card` 浮窗重定向 + 删其 fork 空组件；**保留**选项页 `save-suggestion-toggle` 重定向（那是选项页、非浮窗，功能没了要继续藏开关）。

### D6 allowlist 卫生

本次仅移除 `selection.content/index.tsx`（D1 确认零改动）；`selection.content/app.tsx` 保留（变 shim、真在改）。其余 cruft 不在本次范围。

### D7 复刻、不重设计

视觉与现状一致；功能对等：翻译（LLM 流式 + 标准 provider）、目标语言选择、模型下拉、重生成、朗读、复制、自定义动作执行、错误、右键菜单/快捷键入口。

## Risks / Trade-offs

- **编排漂移**（深层 fork 固有）：复制 provider body → 上游对**编排逻辑**的改进不再自动流入。缓解 = D3 controller hook 结构镜像，diff 面集中。**同步 diff 清单新增**：上游 `translate-button/provider.tsx` + `custom-action-button/provider.tsx` + `selection-toolbar/index.tsx`（药丸复制了其选区检测/定位机制与 module-private helper）+ `selection.content/app.tsx`（shim 后其 body 改动如 `--rf-selection-opacity`/新增同类 hook 会被静默丢弃）。
- **三元组绑定误用**：D4 不变量若被后续误改（某按钮改回 import 上游）→ 运行时崩。design 明写 + 壳文件头注释兜底。
- **复制面**：2 个 provider body + `SelectionToolbar` + 2 个触发按钮 + `app.tsx` 壳（大于「~200-300 行 glue」）；年 churn 集中在 2 个状态机，Toolbar/按钮是低频 wiring。立项成本口径 = 总复制 LOC vs 预期年 churn LOC 两个数分列。
