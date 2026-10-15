# Switch 修复独立审查

结论：本次颜色和动画变量恢复的源码审查通过，未发现新增阻断。

审查绑定的源码 SHA256 与执行结果见 `review-tests.log`。生产变更仅复核
`src/components/ui/base-ui/switch.tsx` 与 `src/fork/ui/options/options-theme.css`；
未修改任何生产代码或已有布局修复。

- `switch.tsx:183` 改用当前主题实际声明的 accent/ring token；options 的 checked
  配色由 `options-theme.css:854` 限定在 options 文档，亮暗主题分别消费 primary
  与 primary-foreground。
- `switch.tsx:210` 的 CSS x 变量直接消费已有 MotionValue；三个尺寸/纵向变量与
  原 width/height 使用同一 animate 目标和 transition，没有增加状态源或事件监听。
- default/sm 的 track、thumb、inset、travel 与非 options 几何未改；组件级检查确认
  两种尺寸的初始数值与四个 CSS 变量正确。
- 取消变更、readOnly、disabled、pointercancel 与正常 detail=1 后续 click 检查通过。
  事件处理本次没有差异。Base UI 的 hidden checkbox click 会停止冒泡，不会由这次
  修复再触发 root。

浏览器拖拽仍待主智能体验收：若释放后产生 detail=0 的 root click，现有
`switch.tsx:169` 会将它视为键盘激活而放行。内存测试确认该序列产生 true→false
两次变更；detail=1 则只变更一次。该分支未被本次修复改动，需结合 before/after
真实事件记录判断主智能体观察到的回弹，不能据组件测试宣称真实拖拽通过。

限制：jsdom 检查没有执行真实 CSS 几何布局或屏幕颜色测量；本审查未访问浏览器、
实际扩展内部页面或运行新的构建。最终亮暗对比、hover/press/spring、实际拖拽以及
完整候选门禁由主智能体整合。
