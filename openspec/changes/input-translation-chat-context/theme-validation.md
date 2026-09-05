# D9–D11 主题优化实施记录（2026-09-05）

## 架构评审

独立 `architect-review` 审查 D9–D11，结论为「审查通过」，无阻断项。已落实两项建议：共享组件只新增默认兼容的可选参数；专属 Portal 容器和条体同属注册的交互根，不能因菜单获得焦点而销毁会话。

实施后的第二轮只读代码复核未发现有证据支撑的 Critical / Important / Minor 缺陷；允许继续交付代码，但明确不能把浅色、窄窗等实页验收视为完成。

## 修改前影响检查

通过 `GITNEXUS_INVOCATION=pnpm node .gitnexus/run.cjs ...` 使用 GitNexus 1.6.11，重建旧版本不兼容的索引后运行 upstream impact：

| 符号                              | 风险 | 直接 / 总影响 | 调用方及流程                                                                                                                                       |
| --------------------------------- | ---- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InputTranslationBar`（Function） | LOW  | 1 / 1         | fork selection App                                                                                                                                 |
| `LanguageCombobox`                | HIGH | 4 / 10        | 输入翻译、偏好语言、朗读语言、翻译中心；PreferencePage / TextToSpeechPage                                                                          |
| `ComboboxContent`                 | HIGH | 7 / 22        | 上述选择器、多语言选择、模型建议、语音、popup、划词；PreferencePage / SelectionTranslationProvider / TTSVoiceCombobox / AutoTranslateLanguagesItem |

HIGH 已在修改前告知用户。共享改动仅可选 `contentProps` / `collisionAvoidance`，默认 bottom、容器和样式保留。新增主题函数尚未入旧图时返回 UNKNOWN，通过本次新增文件和所有文本引用核实仅本地主题模块/测试使用，未当作无调用放行。

图谱生成器的流程枚举有预算截断提示，因此「未列出流程」不等于「不影响」。最初 `detect-changes --scope all` 只覆盖跟踪文件，未把该摘要作为完整证据。随后刷新索引，并使用独立临时 Git index（不改变用户暂存区）把新增文件以 intent-to-add 纳入分析，调用与 CLI 相同的 `LocalBackend.detect_changes(scope=all, limit=1000)`，检查原始结构化结果：24 文件、109 符号，结果无 `partial` / `truncated` / `error`；所有新增生产主题模块均列入。新增 `useInputTranslationTheme` upstream 为 LOW，调用链为 InputTranslationBar → fork App。结果中的空 affected_processes 不作为无影响保证，仍按前述 HIGH 调用半径回归。未执行提交；后续代码变化后提交前仍须重查。

## 自动验证

- 主题解析：先看到 10 条断言失败，再实现站点优先、背景合成及保守回退；13 项通过。
- 局部订阅：先看到 4 条断言失败，再实现属性观察、帧合并、重新聚焦和清理；4 项通过。
- 真实 React/Base UI 组件回归：先看到主题隔离及 Portal 交互断言失败，再修复；菜单打开后换主题保留同一个搜索输入、搜索值和焦点，不触发重译、不写扩展主题。
- Portal 鼠标事件：测试证实 React 冒泡原先取消搜索框原生行为；改为只阻止物理条体内的 mousedown。
- 配色契约：12 个正文/提示/搜索/高亮组合达到 4.5:1。条体次级文案深色 7.42:1、浅色 5.46:1；语言/撤销深色 13.05:1、浅色 14.99:1。这是数值验证，不替代浏览器 computed style 验收。
- 最终全量测试：`WXT_WEBSITE_URL=https://www.readfrog.app WXT_OFFICIAL_SITE_ORIGINS=https://readfrog.app,https://www.readfrog.app SKIP_FREE_API=true pnpm run test`：3285 passed / 4 intentionally skipped（含新增 33 项主题/组件/配色测试）。未修改或删除用户 `.env`。有 jsdom 不支持跨文档 navigation 的已知提示，测试未失败。
- `pnpm run type-check`、scoped oxfmt、`git diff --check`、OpenSpec strict：通过。
- Chrome / Edge / Firefox MV3 production build：通过。存在构建产物大于 500 kB 的体积警告，非本次引入的构建失败。

## 首轮实页验收（2026-09-05，搜索阻断的后续修复见文末，不能宣称全部通过）

用户授权后，通过原生 Chrome UI 操作其已有配置和 Discord 泰语频道，没有另开测试 profile，没有发送消息。浏览器 UA 为 Chrome/152.0.0.0。扩展 ID 为 `lmegaogaablpadepipagnlfdepkncpdh`，扩展管理页确认实际加载路径为 `/Users/yisen/Desktop/Junyun/Projects/Company/translatebuff/.output/chrome-mv3-dev`。

### 开发环境恢复

最初重新加载扩展、刷新 Discord 后仍无内容脚本。扩展页面 DevTools 的 `chrome.scripting.getRegisteredContentScripts()` 返回空数组，Discord 内也无 selection Shadow DOM。WXT dev 依靠后台 WebSocket 初始化消息动态注册脚本；本轮结束旧的项目 dev 进程，重新执行 `pnpm dev`，构建成功后再次重新加载扩展。随后页面出现 `translate-buff-selection`，真实三空格翻译成功。该操作只恢复开发服务，未修改业务代码，保留新的 dev 服务运行。

### 已取得的实页证据

| 场景                | 结果 / 证据                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 真实 Dark 主题      | `html` 含 `theme-dark theme-darker images-dark`；语言、提示与撤销均在深色条体上可读，菜单也为深色，未再出现黑色语言字              |
| 真实 Light 主题     | 通过 Discord Appearance 切换；`html` 含 `theme-light images-light`，scope 的 `data-input-translation-theme` 为 `light`             |
| 真实 Onyx 主题      | 通过 Discord Appearance 切换；`html` 含 `theme-dark theme-midnight images-dark`，scope 为 `dark`                                   |
| 浅色 computed style | 语言与撤销 `rgb(32,33,39)`；提示 `rgb(96,101,112)`；菜单背景 `rgb(247,247,248)`；选中行背景 `rgb(228,229,233)`，与已测配色契约一致 |
| 菜单向上展开        | 深浅色页面截图均显示菜单位于条体上方；实际菜单宽 280 CSS px，高 356 CSS px（含搜索区），内部列表滚动，泰语有选中勾选               |
| 三空格              | 测试原文 `Hello, how are you today?` 变为 `สวัสดี คุณเป็นอย่างไรบ้างวันนี้?`，出现泰语 / 自动检测 / 撤销                           |
| 失焦恢复            | 点击 Discord 搜索框隐藏条体，重新点击原消息输入框后恢复                                                                            |
| 分层 Esc            | 第一次 Esc 只关菜单并保留条体；第二次关闭条体，重新聚焦不恢复                                                                      |
| 编辑后撤销          | 全选删除译文并改为 `edited translation draft 123`，条体仍保留；撤销恢复最初英文，不是编辑后的文本                                  |
| 原文重译            | 在译文被编辑后选择荷兰语，得到 `Hallo, hoe gaat het vandaag?`，条体显示荷兰语 / 手动选择；没有翻译后加的编辑内容                   |

深色 Discord 与浅色扩展界面组合已目视检查；未修改扩展主题配置。截图证据存在本轮 CUA 工具输出中，但尚未导出为独立原始截图文件，不能把截图归档要求算完成。

### 阻断项：语言菜单搜索框按键后焦点回到 Discord 输入框

复现：三空格翻译 → 打开语言菜单 → 点击搜索输入 → 分别按 `e`、`n`。搜索框仍为空，字符出现在 Discord 消息草稿末尾。深浅色均可复现；使用逐键输入也复现，不仅是批量输入接口差异。

临时只读事件观察（随后已移除）看到：mousedown 命中 Shadow DOM 的 INPUT 且未被 preventDefault；focusin 到 INPUT；keydown 在 INPUT 发生后，focusin 转向宿主的消息 DIV。说明搜索框能获得初始焦点，但按键后无法保持。具体抢焦点监听器尚未定位，不能仅凭此认定是哪段业务代码导致。此前组件级测试通过不能替代这个宿主页面验收失败。

本轮只验证和记录，未擅自修改生产代码修复此缺陷。任务 8.8 保持未勾选。

### 仍未完整验收

- 浅色 Discord + 显式深色扩展的反向不一致组合。
- 菜单打开时真实主题变化下的焦点、搜索内容保持（已有搜索焦点阻断）。
- 窄窗口和长名称：尝试 600×800 桌面模拟视口时，Discord 输入区发生重排，未取得可判定的菜单边界 / 长名称证据，不能记通过；设备模拟已退出。
- 同语言提示、所有悬停/键盘焦点的实际对比度、设置页与划词浮窗完整目视回归。
- 实际发送后关闭：本轮未发送任何测试消息，因此不新增此项实页通过结论。

任务 8.2 已完成；8.6 与 8.8 保持未完成。自动验证结果沿用前述记录，本轮没有新增业务代码，不重复声称运行全量测试。

收尾已恢复用户原有 Discord Dark 主题及草稿 `สวัสดี`；再次刷新页面后确认草稿仍为该文本。临时焦点观察器已移除，页面 DevTools 已关闭，设备模拟已退出，全程未发送消息。

## 追加：菜单抢焦点定位与修复（2026-09-05）

用户确认「先定位抢焦点来源，再做菜单局部事件隔离」后实施。范围仅为 `InputTranslationBar` 的局部事件边界、对应测试与 changeset，不修改共享选择器、全局 WXT isolateEvents、主题配置或翻译原文快照逻辑。

### 根因证据

在已有 Chrome Discord 中临时包装 `HTMLElement.prototype.focus`，仅记录消息 textbox 的 focus 调用栈，原样调用原函数、不改变行为。键盘复现得到 `event=keydown, eventPhase=3`，调用链来自 Discord：

```text
Object.focus — discord.com/assets/661212.f8156c4d7fe71722.js:1:4556
Object.focus — discord.com/assets/web.f803cc09a978437c.js:62:972504
Object.focus — discord.com/assets/web.f803cc09a978437c.js:62:830451
eS.<anonymous> — discord.com/assets/web.f803cc09a978437c.js:62:840620
```

仅隔离键盘后，普通输入成功，但真实粘贴仍抢焦点。再次取得独立证据：`event=paste, eventPhase=3`，同样来自 Discord，包含 `Object.current — web.f803cc09a978437c.js:62:836015` 和 `Array.e — web.f803cc09a978437c.js:145:1440467`。因此不是扩展失焦恢复主动调用 focus，而是菜单事件传播到宿主后被其冒泡处理接管。上述资源名仅为本次诊断证据，未硬编码进生产代码。

### 实施与隔离边界

- GitNexus upstream impact 绑定本仓库/当前分支，索引为 2026-09-05 11:40 的 e9de7a7；`InputTranslationBar` LOW，直接调用方为 fork selection App，未报告受影响流程。
- 在当前 Portal 所属 `ShadowRoot` 的冒泡阶段监听 `keydown / keypress / keyup / paste`，用 `composedPath()` 和当前 Portal 容器归属限定事件来源。
- React/Base UI 在内部先完成搜索、导航及选中，再阻止事件到达宿主；不在 Portal 容器上提前打断 React 的委托处理。
- 只 `stopPropagation()`，不 `preventDefault()`、不全局拦截、不定时抢回焦点、不重放键盘事件。卸载/容器变化时移除监听。
- 键盘三条回归先红后绿；粘贴另补一条失败回归再修复。使用真实 ShadowRoot 和真实 Base UI，并模拟宿主冒泡监听抢焦点，断言焦点、消息草稿、默认行为和菜单选择。

### 正式代码验证结果

临时隔离实验后刷新正式 dev 产物，控制台确认 `__rfFocusProbe` / `__rfMenuProbe` 都为 undefined，排除依赖探针才能通过。

- Chrome dev 实页：逐键输入 `eng` 正常筛选，消息草稿未追加字符；粘贴 `English` 正常显示唯一英文候选，消息草稿仍为 `สวัสดี`。
- 修改/删除搜索内容保持在搜索框；观察到中文输入内容也留在搜索框。但原生自动化的 Cmd+A / 非 ASCII 粘贴有不稳定表现，完整输入法候选确认、所有系统快捷键仍应保留人工验收，不将这些工具动作全部记为通过。
- 在英文候选中按 Down + Enter，菜单关闭并基于原文重译为 `Hello`，未发送消息。
- 失焦隐藏、回焦恢复、第一层 Esc 关菜单、第二层 Esc 关条体均通过。
- 本轮未重测浅色/窄窗/长名称等原有未完成项，8.8 不因此勾选。
- 新增 9 项回归；组件文件 13 passed，输入翻译相关 73 passed；全量 3294 passed / 4 intentionally skipped（沿用前述测试专用官网环境变量与 SKIP_FREE_API=true）。
- type-check、scoped oxfmt、git diff --check 通过；最终 Chrome production build 通过，仍有既有大 chunk 警告。实页测试对象是 `.output/chrome-mv3-dev`，不把 production 构建成功表述为 production 实页验收。
- 独立只读代码复核无 Critical / Important / Minor，复跑组件 13 项通过。未提交、未归档；提交前仍需针对当时完整工作树进行 GitNexus detect_changes。

本轮收尾再次刷新确认原草稿为 `สวัสดี`，原 Dark 主题未改，临时探针与测试会话已清除，页面 DevTools 已关闭，全程未发送测试消息。
