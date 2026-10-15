# 非云 UI 调用契约审计

- 工作树：`/Users/yisen/.codex/worktrees/upstream-sync-v1-51-0/translatebuff`；HEAD：`e1d90dc928ca5fbbbba112e480131e1c909c93ce`。
- 固定目标：`55bcef1e684fb4e70f4dce3063e7bd3066f46891`。生产初始只读；root批准后仅修复 fork Toolbar 的 ShadowRoot 判断函数。
- 不审页面路由或云 throw 消费者，不操作浏览器/账号，不构建或提交，不改根 tasks/reports。

## 结论

确认并修复 1 个共享组件 DOM 契约适配遗漏：嵌套 ShadowRoot 内结果选区被当作页面选区。新增回归先出现 1 PASS / 1 FAIL，最小函数修复后相关 5 项全部通过。order/unpinned 和 Hub朗读保留为兼容性/产品边界gap；Popup词典摘要后续经真实DOM确认并最小修复，详见popup-summary-result.md；其余两项未扩大生产修改。

## 实际入口与新依赖

| 实际入口                                                                                | 新依赖/契约                                                                                    | 当前消费者结果                                                                                                                                                | 测试覆盖界限                                                                                                                             |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| popup/app.tsx → fork/popup/App.tsx                                                      | 共享 Hotkey / TranslateButton / TranslatePromptSelector / SiteControlToggle                    | 按现 props 组合；配置字段 node.enabled/hotkey、pageTranslation.mode/providerId 与上游一致。未发现新增必挂 context 被遗漏。                                    | fork/ui/popup/**tests**/translation-mode-selector.test.tsx；本轮只读，未重跑                                                             |
| fork popup → fork language-options-selector                                             | BaseUI Combobox 的 LanguageItem 对象 value / onValueChange(item/null)                          | 与55bcef仅布局样式差异；语言对象形态和 source=auto 处理相同。                                                                                                 | 未发现实际 fork language selector 组合行为测试                                                                                           |
| fork popup → fork ProvidersField                                                        | FeatureProviderSelectorList / local ProviderSelectorOption                                     | 选择器新 props 已传 providerSelectorTriggerSize；仅 W04 摘要枚举旧数据位置。                                                                                  | 缺少 builtInActions-only 摘要测试                                                                                                        |
| translation-hub app → TranslationPanel → 构建重定向 fork TranslationCard                | providerId/isExpanded/onExpandedChange；公用 request atom；AbortSignal；mutation loading/error | 三项 props 与目标一致；新请求/卸载取消、timestamp触发、迟响应id守卫和错误态保留。TTS 差异见W03。                                                              | 原件 translation-card.test.tsx 不经 fork 插件；实际 fork Card 的请求取消/错误态缺专门组合测试                                            |
| Hub TextInput/Panel/Dropdown → fork atoms                                               | 公用持久选择 atom、ProviderRef 形态和 TranslateRequest                                         | 已修的 persisted public selection 接线保持；fork Card 获取原始 ProviderConfig 后传 executeTranslate，符合其参数类型，不能把两种层级的 provider 形态当成新错。 | fork/ui/translation-hub/**tests**/atoms.test.ts；translate-request-activity.test.tsx（本轮未重跑）                                       |
| selection.content app shim → fork App                                                   | Toast/Theme/QueryClient、SelectionSpeechProvider、InputTranslationBar callbacks                | 已修项源码仍在，未反复复测：speech provider 包裹实际工具栏；bar 的 retran/undo/retry/dismiss/interaction/menu callbacks 全接。                                | app-speech-provider.test.tsx；input-translation 既有行为测试                                                                             |
| fork SelectionTranslationProvider → 共享 SelectionPopover / TranslationContent / Footer | actionsRef/requestOpen/onReuseRequest、thinking/error/isTranslating、provider options          | Root 的 pinned reuse 入口、close cancel/runId守卫、流式快照、error对象和 footer 回调签名已匹配；fork 三元组 context 一致。                                    | fork custom-action-input-context 与 shared原件 request-rerun 分开；实际 fork translation controller pinned-reuse/late-chunk 缺组合级用例 |
| fork SelectionCustomActionProvider → CustomActionContent                                | status/selection/targetCode、value/thinking、layout ShadowRoot                                 | 新增 layout 状态/selection/targetCode 数据均已传；布局升级产生的 DOM 边界遗漏为W01，已修。                                                                    | 本轮新增真实fork组件嵌套shadow RED→GREEN；无网络/浏览器                                                                                  |

## W01 嵌套动作布局 ShadowRoot 的选区被误判为页面选区

分类：已证回归，最小修复已GREEN。

**entry**：selection.content/app.tsx shim → fork App → fork SelectionToolbar

**newDependency**：SelectionCustomActionProvider → 共享 CustomActionContent → CustomActionLayoutView → @read-frog/layout-engine 0.5.0 LayoutView/createLayoutMount，布局新增一层 open ShadowRoot。

**failure**：原 fork 守卫只检查一次 contains/closest/getRootNode；选区边界位于布局 ShadowRoot 时三项均无法识别外层扩展覆盖层。document mouseup 随后把扩展结果正文建立成新 selectionSession/contextSnapshot。

**fix**：仅将 isNodeInsideSelectionOverlay 改为逐层 current.getRootNode().host 遍历；三种原判据保持不变；无新配置、context、渲染、模型选择或请求。

**limits**：真实 fork React 组件及 document 事件处理被执行；JSDOM 的 Selection 与几何受控。是组件组合回归，不声称实站浏览器已复现/验收。

证据：

- `src/entrypoints/selection.content/index.tsx:62`：外层 createShadowRootUi 及 App 挂载
- `src/fork/ui/selection-content/SelectionCustomActionProvider.tsx:75`：实际组合共享 CustomActionContent
- `src/components/custom-action/custom-action-content.tsx:73`：实际挂载 CustomActionLayoutView
- `src/components/layout-host/custom-action-layout-view.tsx:92`：实际 LayoutView
- `src/entrypoints/selection.content/selection-toolbar/index.tsx:112`：固定上游的逐层 host 遍历，当前该原件与 55bcef 一致
- `src/entrypoints/selection.content/selection-toolbar/__tests__/selection-toolbar.test.tsx:660`：固定上游嵌套 shadow 回归来源
- `src/fork/ui/selection-content/SelectionToolbar.tsx:117`：本轮唯一生产修改函数

实际结构：`document → 扩展 shadow host → ShadowRoot → popover → LayoutView host → 第二层 ShadowRoot → 结果文本`。已安装 layout-engine 0.5.0 的 `dist/dom.js` 的 createLayoutMount 实际调用 `container.shadowRoot ?? container.attachShadow({mode:"open"})`；不是仅靠注释推断。

最小回归移植固定目标 `selection-toolbar.test.tsx:660–700`：实际渲染 fork Toolbar，向 document 发送 mouseup，Selection API 提供布局树内边界；JSDOM 没有跨shadow选择能力，故只受控注入 Selection/几何。普通一层shadow对照PASS，原fork嵌套用例把结果建立成新selectionSession，产生RED。修复未换成自测helper。

新增用例：`src/fork/ui/selection-content/__tests__/nested-shadow-overlay.forktest.tsx`。保留原错误日志，不把fixture初始化错误计为RED。

## W02 fork 药丸未接完整 order/unpinned/MoreMenu 契约

分类：兼容性gap，不作为当前可见UI故障，不改生产。

**counterEvidence**：用户动作拖拽会重排 customActions；fork 读取该数组，所以用户动作彼此排序仍生效。当前可见 fork 设置没有独立 pin/unpin 写入控件。

**productBoundary**：2026-07-22-fork-selection-toolbar-shell/design.md 明确保留 fork 药丸 JSX 和功能对等，但未明确批准或排除后来的 MoreMenu/pin 交互。根代理决定保留 compatibility gap，本轮不引入菜单。

**minimalFutureAdaptation**：若以后批准完整语义，基于 getSelectionToolbarItems 过滤获准字典及用户动作，保持 fork context/触发器；不能直接导入上游 MoreMenu，因为其翻译/动作 hook 消费上游私有 context。需要先为 fork context 补 openToolbarTranslation 才能等价接线。

证据：

- `src/entrypoints/options/pages/custom-actions/components/action-card-list.tsx:77`：实际可见拖拽调用 setSelectionToolbarCustomActions
- `src/utils/selection-toolbar-items.ts:84`：同时更新 customActions 新数组和 order
- `src/fork/ui/selection-content/SelectionToolbar.tsx:538`：取 features 和 getSelectionToolbarActions
- `src/fork/ui/selection-content/SelectionToolbar.tsx:578`：固定 translate/speak 后遍历全部 enabled actions
- `src/entrypoints/selection.content/selection-toolbar/more-menu.tsx:144`：unpinned 唯一交互写入点；fork 没有挂载该菜单
- `src/fork/upstream-admission.ts:15`：仅 dictionary 内置动作获准；不能用 improveWriting 默认 unpinned 作为实际产品故障例子

## W03 Hub fork 翻译结果卡缺目标朗读入口

分类：待产品边界判断的UI功能gap，不定产品bug，不改生产。

**disposition**：Root 要求独立UI差异未确认前只列 gap，不在本轮恢复朗读按钮。

证据：

- `src/entrypoints/translation-hub/components/translation-card.tsx:50`：目标读取 tts 配置并 useTextToSpeech
- `src/entrypoints/translation-hub/components/translation-card.tsx:203`：加载/播放/停止状态及 handleSpeak
- `src/entrypoints/translation-hub/components/translation-card.tsx:249`：成功结果朗读按钮
- `src/fork/ui/translation-hub/translation-card.tsx:34`：fork 卡片未挂 TTS hook，成功结果只提供复制/重试等原有控件
- `src/entrypoints/translation-hub/components/__tests__/translation-card.test.tsx:111`：上游 speech 测试导入未重定向原件；不能证明 fork 卡片具备此行为
- `src/hooks/use-text-to-speech.tsx:112`：共用 Edge TTS 消息；非本次云 throw 消费者审计

## W04 Popup 头像摘要仍只枚举 customActions，未纳入移至 builtInActions 的已启用词典

分类：后续已确认并修复的展示回归；最初只读发现保留，当前处置见下。

**effect**：词典 provider 若不与任何 FEATURE_KEYS 或用户动作共用，实际可配置/可执行但不会出现在 popup 折叠头像摘要或其数量中；不影响执行、provider 选择和账号/key。

**原coverageGap**：最初仅有 mode/root-width/blog；本轮已新增真实ProvidersField的4项组合回归。

**最终处理**：仅把 action 遍历改为获准 getSelectionToolbarActions；新增词典sole-provider RED→GREEN，disabled/未准入/用户动作对照通过；重复feature槽位保留。独立复审通过，见popup-summary-result.md及review.md。

证据：

- `src/fork/ui/popup/providers-field.tsx:45`：FEATURE_KEYS 后仅遍历 selectionToolbar.customActions
- `src/entrypoints/popup/components/providers-field.tsx:53`：目标使用 getSelectionToolbarActions，包含内置动作
- `src/fork/upstream-services/custom-actions.ts:29`：实际 fork 获准集合为已批准内置动作和用户动作

## 影响与验证

- GitNexus绑定本工作树；索引commit与HEAD同为e1d90dc。dirty修复和构建期redirect是盲点，已补查实际shim、wxt重定向和消费者源码；0caller未作为安全证据。
- 精确helper UID的upstream impact：LOW，6 affected，2 direct caller（selection与mouse守卫），后续是mouseup/mousedown/selectionchange/deferred；0 process不是无影响结论。原件 `/tmp/tb-sweep-shadow-impact.json`，副本 `wiring-shadow-impact.json`。
- RED：`wiring-shadow-red.log`，1 PASS / 1 FAIL。
- GREEN：`wiring-shadow-green.log`，2 files / 5 tests PASS（新2项+现有deferred-selection3项）。
- `oxfmt --check`、两个文件 `oxlint --type-aware --type-check`、`git diff --check` 均通过。
- 根vitest未收forktest的首次发现日志及JSDOM Range初始化错误另存，均未当作产品失败。
- 首次Shadow修复的生产diff仅 `SelectionToolbar.tsx:isNodeInsideSelectionOverlay`；后续W04另有已审popup枚举修复，约束、模型、配置不改。新测试与本wiring证据为本代理写集，其余dirty由其他工作者拥有。

后续由root统一审查、集成、构建和浏览器验收。本审计不把组件级GREEN写成实站验收通过。
