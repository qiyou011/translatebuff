## 1. 影响分析与行为基线

- [x] 1.1 按项目 AGENTS.md 要求对 options 外壳接缝及其上游调用方执行 GitNexus impact 分析；若结果为 HIGH 或 CRITICAL，先向用户报告并暂停编辑，若为 UNKNOWN，则补充文本搜索确认调用边界
- [x] 1.2 盘点当前 options 路由、设置项、配置读写、校验、保存条件、Portal 容器与可触发状态，形成“现有页面／组件／状态 ↔ Figma 节点”核对清单，明确排除设计稿独有功能
- [x] 1.3 为 options 文档级作用域的挂载与卸载、主题模式继承和非 options 界面隔离编写先失败的 fork 测试，断言不涉及业务行为变更

## 2. 设置页视觉作用域

- [x] 2.1 在 `src/fork/ui/options/` 建立专属外壳与视觉入口，复用上游 AppShell，并为 options 文档标识实现成对的挂载与清理生命周期
- [x] 2.2 将 options 外壳接入 `FORK_UI_REDIRECTS`，更新重定向内容指纹与对应护栏测试，确认上游原实现仍可由 fork 包装模块直接复用
- [x] 2.3 运行 fork 定向测试，验证文档级作用域可覆盖与 AppShell 同级的设置搜索、Toast 和默认 Portal，且不改变容器、事件、焦点或关闭行为

## 3. Figma 视觉还原

- [x] 3.1 [Figma 还原] 还原「设置页面与路由视图」 — 对应 design.md Figma 节点清单第 1 行。
      实施路径：用 Skill 工具加载 /figma-implement-design SKILL，参数 figma-url=https://www.figma.com/design/h8L4ynk2dPrJOqRm3j9UYH/%E4%BB%BB%E8%AF%91%E7%9E%84?node-id=276-4674&p=f&m=dev。
      执行约束见 design.md D-VR；业务接入参照 design.md D1、D3。
- [x] 3.2 [Figma 还原] 还原「设置页组件与明暗主题规范」 — 对应 design.md Figma 节点清单第 2 行。
      实施路径：用 Skill 工具加载 /figma-implement-design SKILL，参数 figma-url=https://www.figma.com/design/h8L4ynk2dPrJOqRm3j9UYH/%E4%BB%BB%E8%AF%91%E7%9E%84?node-id=467-5103&p=f&m=dev。
      执行约束见 design.md D-VR；业务接入参照 design.md D2、D3。
- [x] 3.3 [Figma 还原] 还原「现有控件与弹层的交互状态」 — 对应 design.md Figma 节点清单第 3 行。
      实施路径：用 Skill 工具加载 /figma-implement-design SKILL，参数 figma-url=https://www.figma.com/design/h8L4ynk2dPrJOqRm3j9UYH/%E4%BB%BB%E8%AF%91%E7%9E%84?node-id=467-5104&p=f&m=dev。
      执行约束见 design.md D-VR；业务接入参照 design.md D4、D5。
- [x] 3.4 [Figma 还原] 按补充规范统一现有弹窗、侧边弹窗和所有下拉选项框的视觉 — 对应 design.md Figma 节点清单第 4 至 6 行。
      实施路径：用 Skill 工具加载 /figma-implement-design SKILL，分别读取 node-id=446-3747、448-3857、405-3539。
      执行约束见 design.md D-VR；仅调整现有状态的视觉，不修改业务与交互行为。
- [x] 3.5 [Figma 复核] 按最新明暗主题、基础组件、功能示意图与侧边栏规范复核并修正现有视觉 — 对应 design.md Figma 节点清单第 7 至 10 行。
      实施路径：用 Skill 工具加载 /figma-implement-design SKILL，分别读取 node-id=469-5104、303-3、423-3696、332-678，并下钻到实际使用的组件实例。
      执行约束见 design.md D-VR；只调整 options 视觉与静态插画，不修改事件、状态和配置行为。

## 4. 行为与视觉验收

- [x] 4.1 完成 options 现有路由的浅色、深色与跟随系统主题核对，覆盖菜单、弹窗、抽屉、提示、选择器、编辑器以及现有空、加载、错误、保存和键盘焦点状态
- [x] 4.2 用行为回归证明设置项、导航、配置读写、校验、保存条件、权限、列表内容、事件、焦点和关闭结果与变更前一致，并确认设计稿独有功能未被实现
- [x] 4.3 使用真实构建的扩展逐页进行 Figma 对照验收，并回归 popup、sidepanel、content UI、翻译中心和设置页预览内容未受影响
- [x] 4.4 为 `@read-frog/extension` 添加符合 conventional commit 格式的用户可见 changeset

## 5. 交付门禁

- [x] 5.1 设置 `SKIP_FREE_API=true` 运行相关 fork 测试与完整测试，随后执行类型检查、Chrome／Edge／Firefox 构建、fork 构建断言和边界检查
- [x] 5.2 按项目 AGENTS.md 运行 GitNexus detect-changes；若结果为 partial、truncated 或 UNKNOWN，补齐分析后再判定影响范围
- [x] 5.3 复核最终差异仅包含视觉实现、测试、护栏接缝和 changeset，确认没有配置、协议、权限、数据或交互行为变更

## 6. 用户复核修订

- [x] 6.1 统一输入组件默认、悬停及输入态视觉，保留错误与禁用状态
- [x] 6.2 将 Dialog 蒙层修复为本页半透明覆盖，并按用户要求加深至 15%
- [x] 6.3 修复窄触发按钮导致的长下拉选项裁切，验证明暗主题与窄屏
- [x] 6.4 复核业务代码差异；完整测试 3509 项通过，类型检查和生产构建通过，后续纯 CSS 修订完成针对性浏览器验证与构建
