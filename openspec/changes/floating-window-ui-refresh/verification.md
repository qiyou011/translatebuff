# 实施验证记录

日期：2026-09-15。基准提交：33d5869d11390e4f494efd98d1ce8f51fd8cd396。变更未提交、未推送、未发布。

## 范围与审查

- 架构审查：审查通过；实现审查未发现 Critical / Important 问题。
- 实现审查指出规格中“锁定时不启动拖拽”不属于既有行为，已删除该新增承诺；业务实现未因此改动。
- 主入口、翻译按钮、关闭菜单、锁定的消息、事件与配置持久化逻辑保持不变；仅删除悬浮窗反馈入口的专用处理代码。
- 上游翻译按钮仅增加可选 icon 展示参数，默认展示与动作保持不变；allowlist 仅精确新增该文件和 changeset。
- GitNexus 对 FloatingButton、HiddenButton、FloatingButtonCloseMenu、FloatingButtonLockControl、TranslateButton 的 upstream 分析为 LOW；其中关闭菜单直接调用者为 fork FloatingButton。构建别名未被完整表达为调用图边，另已核对 wxt.config.ts 的入口和隐藏按钮重定向及实际消费者。
- 对当前已跟踪差异和全部未跟踪文件调用项目 classifyChangedFiles，越界文件为 0。

## 自动检查

- `SKIP_FREE_API=true pnpm run test --config vitest.fork.config.ts src/fork/ui/side-content/floating-button/__tests__/index.forktest.tsx`：21/21 通过；新增品牌资源和无反馈断言已先观察到失败。
- `SKIP_FREE_API=true pnpm run test src/entrypoints/side.content/components/floating-button/__tests__/index.test.tsx scripts/__tests__/check-fork-boundary.test.ts`：41/41 通过。
- 修改的四个 TSX 文件通过 `oxlint --type-aware --type-check`；TSX 和 allowlist 通过 oxfmt 检查；`git diff --check` 通过。
- `node scripts/pack.mjs test`：成功，测试域注入检查通过；`.output/translatebuff-1.4.0-test-chrome.zip` 为测试环境包，约 5.64 MB，manifest 版本 1.4.0。
- 未执行全仓库完整测试；外部免费翻译服务不作为本地验收项。构建存在包体大小提示，Vitest 存在 Vite 后续原生配置加载兼容提示，均未导致本次检查失败。

## Figma 与真实扩展证据

- 通过 figma-implement-design 工作流读取目标根节点、所在页 Slice 和导出设置，根节点无 Export、所在页无 Slice；SVG 使用精确节点 exportAsync 导出并本地引用，不使用远程素材 URL、不手写 SVG。
- 目标展开态主要控件在同尺寸截图坐标下核对：主入口 (205,85) 40×40；翻译 (211,49) 28×28；设置 (211,133) 28×28；关闭 (168,73) 32×32；锁定 (168,105) 32×32，浏览器与设计一致。
- 工具按钮背景使用设计原值；半像素描边采用内阴影避免 Chromium 在 DPR 1 下将 CSS border 取整。主图保留正式导出的阴影出血，不拉伸。
- Chrome for Testing 151.0.7922.34，独立临时 profile，加载 `.output/chrome-mv3`，本地空白 HTTP 页面，viewport 1000×800、DPR 1。
- 五个控件与资源全部可见且图片加载成功；无反馈入口。验证左右贴边、悬停、长按仅显示主入口、拖拽释放无纵向跳位、锁定重载持久化、菜单打开后鼠标移出仍展开。
- 主入口 panel 分支触发真实 chrome.sidePanel.open（包装原函数仅记录调用，仍执行原函数）；translate 分支通过真实键盘事件验证翻译标志开关。未据此声称系统侧栏原生窗口视觉已验收，也未调用外部服务验收翻译质量。
- 展开态 Figma 248×210 基准与真实截图同尺寸比较：白底合成后平均通道绝对误差约 0.502/255；通道差大于 8 的像素约 2.29%。存在边缘抗锯齿/阴影栅格差异，不声称逐像素完全相同。
- 原始截图：`/tmp/translatebuff-floating-browser-full.png`；局部裁剪：`/tmp/translatebuff-floating-browser-crop.png`；左侧截图：`/tmp/translatebuff-floating-left-full.png`；Figma 基准：`/tmp/translatebuff-floating-figma.png`。临时测试浏览器、服务器和 profile 已关闭或清理。

## 交付与未验收边界

- 测试包解压后，在 Chrome 扩展管理页开启开发者模式，选择“加载已解压的扩展程序”并指向含 manifest.json 的目录；刷新已有测试页面。
- Firefox 真机、其他系统和商店发布未验收；Firefox 提示与全屏取消等行为由既有组件测试覆盖。
- 仅目标 Figma 展开态进行精确视觉对照，左右侧和拖拽态验证交互及布局，没有宣称设计文件其他状态全部完成视觉验收。
