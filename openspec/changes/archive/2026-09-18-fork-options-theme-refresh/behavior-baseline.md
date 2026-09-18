# Options 视觉变更行为基线

## 不变量

- 保留 `ROUTE_DEFS` 中全部现有路由及其组件映射，不新增、删除、重排或重命名路由。
- 保留现有设置项、分组、导航、配置读写、校验、保存条件、权限与列表内容。
- 保留 Select、Combobox、Dialog、AlertDialog、Sheet、DropdownMenu、Popover、HoverCard、Tooltip 与 Toast 的挂载容器、事件、焦点和关闭行为。
- 保留 `ThemeProvider`、主题 atom、初始化和系统主题监听；不新增主题状态或存储字段。
- 设置页预览仅改变其外围设置界面，预览所表达的实际翻译效果不变。
- popup、sidepanel、content UI 与翻译中心不继承 options 专属视觉规则。

## 页面与节点映射

| 当前实现范围                                                                               | Figma 节点 | 实施边界                             |
| ------------------------------------------------------------------------------------------ | ---------- | ------------------------------------ |
| AppShell、侧边栏、窄屏顶部栏、全部现有 options 路由与详情页                                | `276:4674` | 仅视觉呈现；沿用当前路由和页面内容   |
| 当前设置页使用的基础控件、设置行、导航、列表、提示、图标及浅色／深色模式                   | `467:5103` | 仅覆盖代码中已有组件和主题模式       |
| 当前可触发的选择器、菜单、确认框、编辑弹层、Prompt、颜色选择器、CSS／JSON 编辑器及反馈状态 | `467:5104` | 仅还原已有状态；不增加状态转换或功能 |

## Portal 与同级节点

- `SettingsSearch` 与 `AppShell` 同处 RecoveryBoundary，options 视觉作用域必须覆盖两者。
- ToastProvider 与 AnchoredToastProvider 位于 AppShell 外层，视觉作用域必须覆盖其文档级 Portal。
- 默认挂载到 options 文档的 Portal 继承 options 主题；显式容器实例逐项核验但不改变容器。

## 明确排除

- Figma 中存在、代码中不存在的设置项、操作、数据、流程或状态转换。
- 配置 schema、迁移、协议、API、权限和持久化逻辑变更。
- 为匹配视觉而替换 Portal 容器、焦点管理、关闭机制或键盘行为。
