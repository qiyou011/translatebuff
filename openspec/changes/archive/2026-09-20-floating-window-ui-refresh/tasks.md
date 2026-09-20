## 1. 实施准备

- [x] 1.1 完成目标组件 GitNexus 影响分析，核实共享展示适配的消费者并记录边界。
- [x] 1.2 更新悬浮窗展示测试要求，保留点击分支、拖拽、锁定、关闭菜单及异常路径回归，先确认新增断言失败。

## 2. 悬浮窗展示

- [x] 2.1 [Figma 还原] 还原「悬浮窗」 — 对应 design.md Figma 节点清单第 1 行。
      使用 /figma-implement-design，设计稿：https://www.figma.com/design/h8L4ynk2dPrJOqRm3j9UYH/任译瞄?node-id=114-4838&m=dev
      执行约束见 design.md D-VR；业务接入参照 design.md D1。
- [x] 2.2 移除悬浮窗反馈入口及其专用无消费者代码，保留共享反馈能力；新增 extension changeset。

## 3. 验证与交付

- [x] 3.1 执行针对性 fork 测试、静态检查与测试环境构建，外部免费翻译测试设置 SKIP_FREE_API=true。
- [x] 3.2 在真实浏览器加载新构建扩展，核对 Figma 属性和截图，回归悬停、左右贴边、拖拽释放、锁定、菜单及既有点击配置分支。
- [x] 3.3 记录验证证据与未验收项，运行 OpenSpec 严格校验并核对变更范围；不自动提交推送或归档。
