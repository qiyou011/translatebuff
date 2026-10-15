# DOM/CSS/主题契约源码审计

- 输入：工作树 `e1d90dc9` + 检查时已有 dirty；固定目标 `55bcef1e`，业务基线 `4be99b34`。六个主题文件的检查时指纹在同名 JSON。
- 排除已修3项：custom-actions整行宽度、Switch旧token/Motion变量、NoteSuggestion挂载。
- 本代理未操作浏览器、构建、测试或账户。以下为源码证据，视觉程度仍需root独立公共组件HTTP fixture。未证实P1。

## P2：浅色 outline-accent 文字低对比（THEME-01）

`options-theme.css:31` 把 `--rf-accent` 定义为浅灰背景值 `#e6e6e9`，新共享 `button.tsx:27–32` 却以此为 `outline-accent` 的文字色，白底静态sRGB对比 **1.246:1**。真实入口为 `action-editor.tsx:331–347` 内置动作“自定义”及 `ai-config-helper-button.tsx:64` AI配置助手。4be前者仍是 `variant="outline"`，存在明确的合并前后契约变化。Tooltip/Popover替换data-slot不会去掉Button的颜色class。

最小fixture：只加载真实theme.css、options-theme.css、Button/Tooltip/Popover，html置data-translatebuff-options-theme，浅色白卡片并排渲染outline-accent xs与outline，检查computed color/background。无需内部设置页或数据。局部候选：给选项页该variant补可读动作前景，勿为此改共享Button或把所有中性hover底色一起改蓝。

## P2：新布局回退提示误用旧warning背景值（THEME-02）

`layout-preview.tsx:247–259` 新RenderNotices用text-warning显示回退原因；`options-theme.css:48/90` 保留浅色#fde68a、深色#713f12，对白底/深色卡片#1c1c1f的静态对比为 **1.245:1 / 1.961:1**。旧token预先存在，但HTML/Liquid布局回退文字消费者为本轮新增，不能把全部历史warning都归为新回归。

最小fixture：同主题下渲染p role=status、text-xs text-warning和警告图标，切light/html.dark。局部候选：区分反馈前景与旧底色用途。

## P2：宽屏布局编辑器被全局640px限制（THEME-03）

`dialog-theme.css:8–20` 未分层普通CSS统一写入width/max-width=640px、top与max-height，压过 `layout-field.tsx:573` 请求：

```text
flex h-[90vh] max-h-[90vh] flex-col overflow-y-auto sm:max-w-[min(1280px,calc(100%-2rem))] lg:overflow-hidden
```

实例 `:578` 仍为lg:grid-cols-2；左pane `:579` min-w-0；右LayoutPreview在 `layout-preview.tsx:295,368–370` 默认固定500px（可切320px）。640px扣23px双侧padding、边框和16px间距后，每列288px。`layout-preview-frame.tsx:59` 有overflow-auto，故能断言宽屏强制横滚，**不能断言内容丢失**。90vh也被主题top/max-height覆盖，需同时检查。

最小fixture：真实DialogContent+上述完全相同class、header、grid min-h-0 flex-1 gap-4 lg:grid-cols-2。左放静态编辑区，右overflow-auto加p-4/fixed500px卡片；1440×1000读dialog宽、列宽与scrollWidth，并确认普通确认窗继续640px。最小候选：仅宽编辑器加明确实例/尺寸标记，局部恢复 **width与max-width两项**（并检查height/top）；保留普通640规范。

## 待证：新xs分段按钮被132×40普通按钮规范放大（THEME-R1）

`options-theme.css:354–369` 只排除size-6/7/8/9。`layout-preview.tsx:110–126` 的320/500、日/月各用两个真实Button size=xs，均命中min-width132px、height40px；Replay `:358` 同样命中。原compact尺寸在button.tsx:47。icon-xs/icon-sm具有size类，不能一并报错。外层flex-wrap仍能换行；需root用288px/600px容器公共ButtonGroup fixture判断排版严重程度，暂不报内容丢失。

## 核对后未报错的边界

- 六文件没有额外旧checked data-state规则；radio/checkbox为Base UI presence属性，主题已用data-checked；不重复计入已修Switch。
- 38个变量引用中app自有变量均有生产定义；--anchor-width/--available-width由Base UI Select/Combobox Positioner生产并继承到Popup，不是缺变量。
- ConfigItem新增label wrapper，但根:has选择器仍由control child匹配，标题描述仍可到达。EntityEditor命名容器/51rem与已修CSS吻合；不按字符串变化报bug。
- Sheet真实输出data-side和starting/ending-style；普通消费者ConfigurePrompt。Sidebar mobile覆盖data-slot=sidebar并带data-mobile=true，普通sheet规则不会错误拉宽它。
- Popup main.tsx:37、Hub main.tsx:22加载共享theme；选项页属性仅由fork app-shell.tsx:10–12挂载。不能把选项页颜色/按钮问题声称为popup/Hub已证回归。共享原语修改仍需顾及它们。

## 图影响与编辑边界

status显示索引e1d90dc与HEAD一致；已query/context补证SheetContent、ConfigItem、CustomizeButton、LayoutPreview。按root追加要求保存完整raw到 `/tmp/translatebuff-theme-{dialog,button,layout,editable-layout}-impact.json`，Dialog用UID消歧。均maxDepth=1、无partial/truncated字段，**仅是无报告不完整的一层有界结果，非完整walk；CSS选择器仍是图盲区**。

| 符号 | risk | 直接 | process | 说明 |
|---|---|---:|---:|---|
| DialogContent | MEDIUM | 8 | 2 | 含EditableLayoutField/CommandDialog/ViewConfig/FieldDialog |
| Button | CRITICAL | 129 | 30 | 16模块含fork popup/Hub；已提醒root避免全局改Button |
| LayoutPreview | LOW | 2 | 2 | EditableLayoutField/ReadOnlyLayoutField |
| EditableLayoutField | LOW | 1 | 0 | 动态composition源码仍需补证，0process不表示未使用 |

## Checkbox追加核对：不列新增回归

root独立fixture观察disabled与enabled根opacity均1。本代理核对4be与55b源均已用disabled:opacity-50和group-has-disabled/field:opacity-50。当前Base UI默认根span（已安装CheckboxRoot.js:242），输出data-disabled，隐藏input才native disabled；无Field祖先的standalone根不会匹配native :disabled，有Field可能走group规则。依赖^1.7.0→^1.9.0，未读取旧依赖实际产物，不能据组件源码断言旧runtime完全相同。

仅写本报告/JSON及root要求的/tmp raw；未改生产、测试、git。源码审计和颜色计算不是实际浏览器/设备验收；无P1不表示其他范围零缺陷。
