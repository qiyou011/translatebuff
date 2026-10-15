# Popup 词典 provider 摘要回归

结论：W04 已由真实 fork ProvidersField 的 DOM 回归确认并最小修复。生产仅增加现成获准 `getSelectionToolbarActions` 导入，并以其替代原 `customActions` 数组枚举。

## 因果与范围

- 固定上游 `55bcef1e` 的 ProvidersField 已使用动作统一枚举；内置词典存储位置为 `selectionToolbar.builtInActions.dictionary`。fork 副本仍只读 `customActions`，漏掉仅为词典配置的 provider。
- 实际入口：`entrypoints/popup/app.tsx:2` shim → `fork/ui/popup/App.tsx:13/35` → `ForkProvidersField`。
- `@/utils/custom-actions` 在正式构建和本轮 fork Vitest 中都经过已有重定向；统一枚举仅包含获准词典与用户动作。未扩大内置动作准入。
- 生产差异为两个位置：新增 import；`for ... of config.selectionToolbar.customActions` → `for ... of getSelectionToolbarActions(config.selectionToolbar)`。其余重复slot、Avatar、Drawer、会员/key/模型/配置路径保持原行为。
- root 初始“重复provider去重”的预期经当前/目标源码反证后已撤回；本轮保留重复功能slot对照，不添加去重，不加入MoreMenu或Hub朗读。

## 有意义的 RED → GREEN

新增 `src/fork/ui/popup/__tests__/providers-field-actions.forktest.tsx` 实际渲染完整 ProvidersField、ThemeProvider、TooltipProvider 和 Base UI Avatar/Drawer，使用真实 schema、storageAdapter、seed hook、准入和解析。只在浏览器/storage测试实现、会员消息网络与图像解码边界受控；没有 mock 摘要/helper/schema/准入/Avatar。

| 用例                                      | 修复前                          | 修复后                                      |
| ----------------------------------------- | ------------------------------- | ------------------------------------------- |
| provider仅由启用词典引用，头像应出现      | FAIL：真实DOM仅4个Microsoft头像 | PASS：新增第5个Dictionary-only provider头像 |
| 共享provider的4个功能slot，禁用词典       | PASS，原重复slot保留            | PASS                                        |
| 未准入内置动作enabled且有有效本地provider | PASS，不进入摘要                | PASS                                        |
| 用户动作provider继续显示                  | PASS                            | PASS                                        |

- RED：`popup-summary-red.log`，1 FAIL / 3 PASS；`popup-summary-red-dom.json` 保留实际摘要DOM。
- GREEN：新测试及相关popup测试 4 files / 9 tests PASS；`popup-summary-green.log`、`popup-summary-green-dom.json`。
- `oxfmt --check`、`oxlint --type-aware --type-check` 两个源码文件均通过；`git diff --check`通过。

## 图与边界

`getSelectedProviderOptions` 精确UID impact=LOW，1直接caller（selectedProviders useMemo）。组件 ForkProvidersField 的图工具输出LOW/0caller，但没有将0作为无消费者证据：已由真实popup App import/JSX和本轮真实组件回归补证 default-export/JSX解析盲点。原始结果在 `popup-summary-enumeration-impact.json` 和 `popup-summary-field-impact.json`。索引HEAD=e1d90dc，dirty修复以当前源核对。

本轮没有构建、浏览器/账号操作、提交或更新根文档；最终包与实机验收由root统一集成。本证据证明组件组合行为，不宣称真实浏览器验收完成。
