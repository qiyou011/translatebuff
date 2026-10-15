# merge-regression-sweep 独立审查

结论：当前候选 PASS，无剩余阻断。审查期间发现的真实 Tooltip/Popover 按钮颜色
选择器遗漏已由 root 修复，并独立复验通过。最终审查源码与测试哈希见 review-tests.log。

## 已关闭的 P2：真实 outline-accent 按钮的 slot 被 render 组合替换

初版 `options-theme.css:382` 仅匹配 data-slot=button，但 `CustomizeButton`
（action-editor.tsx:335-346）及 AI 配置助手（ai-config-helper-button.tsx:64）分别
通过 TooltipTrigger 和 PopoverTrigger render 真实 Button，最终 slot 是
tooltip-trigger/popover-trigger。保留 text-accent 类不等于匹配该初版选择器。

独立真实组合测试两例 RED，证据保留在 review-accent-red.log。root 将规则扩展到
这两个实际 slot，仍限定 html[data-translatebuff-options-theme] 和精确 text-accent 类。
两例复验 GREEN；普通非 accent 按钮及非 options 文档的阴性检查也通过。未改共享
Button 或把主题色变化扩散到 popup/Hub/content script。

## 其他生产变更

- SelectionToolbar.tsx:117 的循环保持原 contains、overlay marker、相同根三项判据，
  逐层检查每个 enclosing ShadowRoot.host；行为与固定目标 55bcef1e 的同名 helper
  一致。未新增选择文本采集、请求或上下文字段。现有 overlay 对照与嵌套回归通过，
  reviewer 额外验证网页自己的 1 层/2 层 shadow 选区仍正常打开工具栏。
- warning-text 仅区分 options 的反馈前景与旧 warning 背景用途；text-warning 消费者
  使用新前景，而旧 bg-warning token 未被改写。
- 紧凑尺寸规则同时要求 options 文档、button-group 祖先、真实 button slot 和精确
  h-6 类，覆盖新 xs 分段按钮，不修改公共 Button，也不影响没有该类的普通操作按钮。
- 宽编辑器使用 DialogContent 实例属性，CSS 同时限定 options 文档和该 marker。
  width/max-width、top、height/max-height 成组覆盖，普通确认窗的 640px 规则不变；
  90dvh 与 5dvh 保持上下余量。layout-field.tsx 对固定目标只有这个 attribute 差异，
  既有编辑、保存、取消、校验及预览逻辑均未修改。allowlist 仅登记此必要上游文件。

此前 custom-actions 容器、Switch、NoteSuggestion 三项修复已保留，没有重复计为
本轮新增修复。

## 测试和准入边界

独立定向 3 文件 67/67 通过：62 项真实 options route smoke、2 项真实 fork overlay
回归及 3 项 deferred selection。真实 layout editor 用例已断言 marker、CodeMirror
内容、preview shadow roots、关闭行为和保存数据不变。新增测试没有 mock 被审查的
Toolbar/helper/布局编辑器/Page 本体；Selection 几何、浏览器观察器及必要存储/RPC
边界被替代，覆盖范围如各测试注释所述。

实际 29 routes 的默认/旧云开关配置均完成挂载并等待查询结束，检查恢复页、加载态、
失败查询和意外 fetch。这是路由与组件接线 smoke，不是每项设置操作全部验收。
生产 diff 未修改 resolver、transport、产品准入或内置动作许可；本轮没有放松 cloud
拒绝，也没有接入固定目标之后的补丁。

## 限制

本审查不操作浏览器、实际扩展内部页、账号或构建，不把 jsdom/独立 primitive
当成真实 settings 全验收。颜色对比、响应式尺寸及真实交互的浏览器证据由 root
独立完成；完整套件、构建包、冻结候选及最终接纳仍由 root 整合。

## 最后增量 W04：Popup 获准词典的 provider 摘要

增量复审 PASS，无新增阻断。`src/fork/ui/popup/providers-field.tsx:22,50` 仅增加
getSelectionToolbarActions 导入并替换动作遍历来源。该 import 经现有 wxt redirect
实际消费 fork 准入 helper：只含获准内置词典及用户动作；原 enabled=false 过滤、
本地 provider capability 解析、noteSuggestion 排除及头像计数/重复 key 规则均未改。
固定目标 55bcef1e 同样通过 getSelectionToolbarActions 遍历，未引入后续目标代码。

独立运行新增四个真实摘要 DOM 用例，4/4 通过，分别验证词典专属 provider 可见、
禁用词典不可见、未准入内置动作不可见及用户动作保留。重复 feature slot 按 root
确认的现有语义保留，不做去重。测试没有 mock 动作准入 helper、provider 解析或摘要
组件，只处理后台消息及 jsdom 不加载图片的边界。

allowlist 相对 HEAD 的新增项中，layout-field.tsx 是本轮已审查 marker；其余四项
均为对应既有修复的精确 changeset Markdown 路径，不是目录、通配符或额外生产源码。
原 boundary guard 未修改。独立只读调用同一 classifyChangedFiles 检查当前 dirty 与
非 ignored untracked 的 167 条路径，0 violations；一个合成未登记 src/utils 生产
路径仍被拒绝，确认发布说明登记未放宽生产边界。root 原 162 条记录是较早快照。

本增量源码哈希、命令与结果记录于 review-popup-tests.log。未访问真实 popup 页面、
账号或运行构建；最终全 fork 套件、产物与浏览器验收仍由 root 完成。
