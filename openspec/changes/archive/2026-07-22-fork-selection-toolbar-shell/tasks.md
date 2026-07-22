## 1. fork context + 目录骨架

- [x] 1.1 新建 `src/fork/ui/selection-content/context.ts`：fork 自建 `SelectionTranslationContext` / `SelectionCustomActionContext` + 对应 `use*Context` hook（供 fork 消费者，替上游 module-private context）
- [x] 1.2 建目录骨架（空文件占位，后续任务填），确认目录约定与 design 文件结构一致

## 2. 翻译 Provider fork（controller hook + 薄壳 + 触发按钮 —— 三元组同进，见 D4）

- [x] 2.1 `use-selection-translation-controller.ts`：**逐行镜像**上游 `translate-button/provider.tsx` body（`:260-736`），`return` 全部态 + handlers（isOpen/anchor/translatedText/error/isTranslating/handleOpenChange/handleProviderChange/handleRegenerate…）。**省略 save-suggestion 行**（`:296-318,541,602,610`）。引擎原语（`translateWithTextStream`/`translateTextCore`/`streamBackgroundText`/`provider-registry`/atoms/config）全部 import 上游，不复制
- [x] 2.2 `SelectionTranslationProvider.tsx`：调 controller → 供 fork context + 组合翻译 popover JSX（镜像 `:745-797`，**去 `<SaveSuggestionCard>`**）。叶子（`TranslationContent`/`Footer`/`Title`/`ErrorAlert`/`target-language-selector`）import 上游；`provider-selector` 走既有 fork 重定向
- [x] 2.3 `TranslateButton.tsx`：fork 版，消费 **fork** context 的 `prepareToolbarOpen`（不 import 上游 TranslateButton）
- [x] 2.4 验证：翻译 LLM 流式 + 标准 provider 两路径、目标语言切换即重译、模型下拉切换、重生成 —— 功能对等

## 3. 自定义动作 Provider fork（三元组同进）

- [x] 3.1 `use-custom-action-controller.ts`：逐行镜像上游 `custom-action-button/provider.tsx` body（复用 `useCustomActionExecution`/`streamBackgroundStructuredObject`/`selectionToolbarCustomActionRequestAtomFamily` import）
- [x] 3.2 `SelectionCustomActionProvider.tsx`：fork context + 动作 popover JSX（镜像 `:383-440`，**去 `<SaveToNotebaseButton>` / `<SaveToNotebaseDialogHost>`**；`disablePointerDismissal` 省略或常量 `false`，**不 import `isSaveToNotebaseDialogOpenAtom`**）
- [x] 3.3 `CustomActionTrigger.tsx`：fork 版消费 fork context（不 import 上游 trigger）
- [x] 3.4 验证：自定义 AI 指令执行 + 结构化输出渲染对等；动作浮窗无「保存到笔记库」

## 4. 药丸 Toolbar fork

- [x] 4.1 `SelectionToolbar.tsx`：import 上游选区检测 / `positioning.ts` / `modal-dialog-host.ts` 机制（不重写），**重写药丸 JSX**（translate/speak/custom-action/close 按钮），渲染 fork 版触发按钮（2.3 / 3.3）
- [x] 4.2 验证：选区触发显隐、定位跟随、各功能按钮按 config features 显隐 —— 对等

## 5. App 壳 + shim 接线

- [x] 5.1 `App.tsx`：fork 壳根 `ToastProvider → ForkSelectionTranslationProvider → ForkSelectionCustomActionProvider → ForkSelectionToolbar`，签名 `{ uiContainer, portalContainer }`、`export default`；壳文件头注释写死 **D4 三元组绑定不变量**
- [x] 5.2 `selection.content/app.tsx` → shim：`export { default } from "@/fork/ui/selection-content/App"`（保 default 导出签名）。确认 `index.tsx` 零改动
- [x] 5.3 验证：浮窗整体挂载无 "must be used within Provider" 崩溃（D4 生效）

## 6. 退役 redirect + allowlist 卫生

- [x] 6.1 `wxt.config.ts`：删 `save-suggestion-card` 重定向条目（壳内不渲染即可）；保留 `save-suggestion-toggle` 条目
- [x] 6.2 删 `src/fork/ui/selection-toolbar/save-suggestion-card.tsx`（退役的 fork 空组件）
- [x] 6.3 `scripts/fork-allowlist.json`：移除 `src/entrypoints/selection.content/index.tsx`（本次零改动）
- [x] 6.4 验证：无悬空重定向（buildStart 不报缺 from）；无对已删空组件的引用

## 7. 验证四关 + 构建 + 实机

- [x] 7.1 `SKIP_FREE_API=true pnpm run test`（移开 .env）全绿——含 controller 复用的上游引擎测试 + fork 壳新增用例
- [x] 7.2 `pnpm run type-check` exit 0
- [x] 7.3 fork 边界：本次改动全在 `src/fork/**` + `app.tsx`/`wxt.config`（allowlist）；**移除 index.tsx 后边界仍绿**；`check-fork-brand` 通过
- [x] 7.4 三构建（chrome/edge/firefox）+ `assert-fork-build` 通过
- [x] 7.5 实机：翻译浮窗功能对等；notebase/猜你想存不出现；**翻译时不发 `streamNoteSuggestion` 请求**（read_network_requests / console 核对，坐实"连请求都不发"）
