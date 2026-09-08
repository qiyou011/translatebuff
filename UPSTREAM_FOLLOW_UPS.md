# 上游问题跟进记录

## 2026-09-08：悬浮按钮拖拽异常收尾与 UI 预览

状态：暂缓本地修复，等待上游相关修复后复查。用户已确认本次不改代码。

### 验证基线

- 当前分支：`feat/fork-foundation-input-trans`。
- 合并提交：`64e682dd263dd9834d4998dd6376e39f92a10b57`。
- 合并来源：`origin/UI-optimization`，提交 `5754dfcb3c3dacc908f425c79ab26089434c2161`。
- 合并前当前分支：`9839ae5e6defcdd14985cc92aff57c6d581a13e2`。
- 环境：juntao Chrome 152，1.3.0 国内测试包，Discord `#elden-fun`。

### 事项一：拖拽异常结束缺少兜底

已确认的代码缺口：合并前的上游悬浮按钮已有相同收尾逻辑，本次 fork 副本沿用，并非本次 UI 合并新引入。

- `handlePointerDown` 捕获指针并启动 350ms 长按计时器。
- 正常收尾仅由主按钮的 `pointerup` / `pointercancel` 调用 `finishPointerInteraction`。
- 当主按钮漏收结束事件时，待处理状态和计时器未清理，可能随后进入并停留在 `cursor-grabbing` 状态。
- 没有针对捕获丢失、窗口失焦的拖拽收尾兜底；`handlePointerMove` 也未检查鼠标按键已释放的情况。

浏览器证据与结论边界：

- 自动拖拽中，按下后 `hasPointerCapture` 为 `true`，按钮一直连接在 DOM 中且节点身份未改变。
- 一次记录中按下到释放约 7ms，没有记录到按住状态的移动事件；释放目标为按钮外的 `DIV`，随后状态卡住。
- 不依赖插件代码的临时原生按钮，同样出现捕获成功后释放落到按钮外的现象。
- 因此不能将自动操作异常直接判定为本次合并回归，也尚未确认用户手动拖拽会复现。捕获异常的外部触发来源仍未确定。
- 现有组件测试直接向按钮派发移动和释放事件，未覆盖“结束事件落在按钮外”的场景。

关注路径：

- 上游：`src/entrypoints/side.content/components/floating-button/index.tsx`。
- 实际运行的 fork 副本：`src/fork/ui/side-content/floating-button/index.tsx`。
- fork 测试：`src/fork/ui/side-content/floating-button/__tests__/index.forktest.tsx`。

### 事项二：设置页预览与实际悬浮按钮样式不一致

`origin/UI-optimization` 自身已有该差异，并非合并遗漏：

- 预览辅助按钮仍为白底灰图标，实际按钮为黑底白图标。
- 预览关闭、锁定按钮仍为 24px 区域 / 12px 图标，实际为 32px / 16px。
- 预览文件：`src/fork/ui/options/overlay-feature-preview.tsx`。
- 实际辅助按钮：`src/fork/ui/side-content/floating-button/hidden-button.tsx`。

### 下次同步上游时的复查清单

- [ ] 检查 read-frog 上游是否修复指针捕获、拖拽终止和计时器清理；不要仅凭相似提交标题判定已解决。
- [ ] 若上游已修复，审阅差异并将必要逻辑迁入 fork 副本，保留本地 UI；仅合并上游原文件不会自动改变重定向后的运行逻辑。
- [ ] 按 `redirect-baseline.json` 指纹护栏要求完成对账，不要仅刷新指纹绕过差异。
- [ ] 用真实构建包验证手动拖拽、左右停靠、异常释放后恢复、普通点击不受影响，并补充异常收尾回归测试。
- [ ] 检查 UI 来源分支是否同步修复预览颜色、控制按钮尺寸，并进行页面视觉对照。

本记录不代表已提交上游 issue、已获上游修复承诺或已开启自动监控；后续同步时复查。诊断探针及临时按钮已清理，未发送 Discord 消息，原草稿已恢复。
