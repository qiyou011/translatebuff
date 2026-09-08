# 内联动作焦点交接修复验收

## 范围与状态

本轮修复真实 Discord 中选择语言、首次失败重试及重译失败重试后，焦点退到页面导致反馈隐藏、结果需要额外点击才写入的问题。沿用本变更立项，在 D15 与任务组 10 登记。当前不提交、不推送、不归档、不改禅道状态。

最终状态（2026-09-08）：本轮 D13–D15 反馈与焦点阻断修复已完成自动回归、独立评审和主 Chrome 实证。新包已重载；临时网络规则与配置档已移除，测试 DevTools 已关闭，原草稿「你好」已恢复，未发送消息。下文锁屏、未部署和待清理描述均为历史过程，以最后的解锁补验与清理记录为准。原主题任务 8.6/8.8 不在本轮完成范围。

设计计划：`docs/superpowers/plans/2026-09-07-input-translation-focus-handoff.md`。
修复前真实记录：`/Users/yisen/.codex/visualizations/2026/09/02/01a06139-72f0-7f00-ab7e-141a224eb680/discord-feedback-browser-test-2026-09-07.md`。

## 设计评审

独立架构评审首次发现 P1：focus 同步触发空草稿会话清理后，动作可能重新 publish 旧会话。方案已补 bar 身份、请求锁、元素连接、URL、草稿与最终焦点复核；正常显示状态更新不误判失效，聚焦至请求启动间不插入 await。复审结论「审查通过」，不代表运行验收通过。

## 证据矩阵

| 要求                                                      | 自动验证证据                                                             | 主 Chrome 证据                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 普通 DOM/Shadow DOM 下选语言不额外点击即可写入            | 真实 Surface 参数化测试通过                                              | 主 Chrome 连续日/俄/韩切换通过                                   |
| 菜单完全关闭后 Loading 持续，选择器禁用、Undo 可用        | deferred 请求及菜单卸载后断言通过                                        | Google 单域 10.14s 慢请求通过                                    |
| 首次失败 Retry、重译失败 Retry 的焦点与反馈连续性         | 普通/Shadow 四组合通过                                                   | 各三轮通过；首次恢复网络成功，译后 Retry 为缓存返回              |
| 聚焦同步结束/替换会话不得复活旧请求                       | empty/draft/route/dismiss/remove 以及 focus 中替换编辑器并启动新请求通过 | 同步重入矩阵由自动测试覆盖，不宣称逐项实页复现                   |
| 用户随后主动失焦不抢焦点，回原框才提交                    | 既有 deferred 与首次 Retry 失焦用例通过                                  | 2.03s 成功响应后外部焦点与旧稿保留，原框回焦才写入               |
| pending 编辑/ABA、Undo、Esc、卸载/路由/新会话使旧结果失效 | 首次 Esc/卸载/移除/路由，以及译后 Undo/ABA/新请求锁均覆盖 resolve/reject | pending Undo 后 2.01s 成功响应未覆盖原文；其余矩阵以自动测试为准 |
| 搜索不污染草稿、键盘选择和分层 Esc                        | 搜索隔离、真实 Surface 键盘选择及两层 Esc 通过；Tab 原生导航未覆盖       | 搜索、Enter、两层 Esc、原生 Tab、三轮快速开关外点通过            |
| 编辑译文后 Undo 恢复最初原文                              | 原文快照/编辑后撤销回归通过                                              | 全选替换译文并新增内容后撤销，恢复最初原文                       |
| 格式、类型、局部/全量测试、工件、图变化、打包             | 第二轮最新命令通过，详见下文                                             | 新包 SHA 一致，扩展 UI 明确「已重新加载」                        |

## 第一轮实现与验证（后续审查补测进行中）

- 相对开工前脏树，仅两个业务文件和 hook 测试增加本批差异。`focusEditorForInlineAction` 位于 hook:500；专属 Popup 使用逐次打开重置的 selectionCommitted。未修改共享组件、引擎或协议。
- 菜单提交红测实际为 1 failed / 63 passed，焦点停在 disabled trigger；实现后用例通过。补普通 DOM/ShadowRoot、首次/重译 Retry、同步 empty/draft/route/dismiss 后局部 10 文件、155 项通过。
- 独立代码审查认可实现；指出“成功提交后再次打开并通过 Esc/Tab/外部点击关闭”验证缺口，已交开发补测。不能据此勾选 10.3。
- 全量首次误收集 scratch 中的两份测试备份，产生两个相对导入失败；已将备份追加 `.snapshot` 后缀保留内容，不改测试配置。重跑 `SKIP_FREE_API=true pnpm run test`：347 文件通过、1 文件跳过，3362 测试通过、4 跳过，退出 0。保留既有 jsdom navigation 提示。
- `SKIP_FREE_API=true pnpm run test --config vitest.fork.config.ts`：64 文件、497 测试通过，退出 0；既有 Vite native config 兼容警告未隐藏。
- `pnpm run lint`（含类型检查）、`pnpm run fmt:check` 均退出 0。
- GitNexus 刷新后原始 `detect_changes`（scope=all、repo=translatebuff、显式当前 worktree、limit=1000）返回 23 tracked 文件、99 符号、low，无 partial/truncated/error 字段；CLI 只展示前 15 符号，因此另外检查原始结果。索引的执行流采样仍有截断，affected_processes=[] 不能解释为无调用链。本批 9 个目标路径（含新报告）另经实际 fork classifier 检查无越界。
- `node scripts/pack.mjs test --edition cn` 退出 0，含测试后端域，manifest 1.3.0/MV3；ZIP CRC 通过。保留既有 chunk >500kB 构建警告。
- 新包：`.output/translatebuff-1.3.0-test-chrome.zip`，SHA256 `5186cb98770fac7debe85aa6ae66473a69097c0b1fa86817b9396e20aeeb7908`；selection.js SHA256 `010dcbaf165de51fced807e366aae9b2ea7d27921d0cc1c4d43d943284d780dc`。尚未部署/重载到主 Chrome，不能用于声称实页通过。

## 主 Chrome 待解除条件

### 审查补测轮次

- 第一轮补测局部 163 项通过，仅增加测试；真实 Tab 因 jsdom 不执行原生导航仍待 Chrome。Esc/外部关闭测试尚需补实际深层焦点断言，不能只凭 editor.focus 未被调用证明默认返焦恢复。
- 随后的全量实测退出 1：3369 通过、4 跳过、1 失败；失败在 `supports keyboard language selection and layered Escape dismissal in shadow DOM`，第一次 Esc 后 Undo 已不存在。已进入第二轮根因排查，未跳过用例、未将此前全量绿结论当作当前完成证据。
- lint/fmt、严格 OpenSpec 与 diff 空白检查在本轮仍通过；这些不替代上述功能失败。

### 第二轮修复后的新鲜验证（2026-09-08）

- 采用架构审查通过的局部方案 B：Esc 在菜单卸载前同步返焦启用 trigger；未修改 HIGH 风险的 hasFocusWithin。第二轮代码复审判上轮 Important 已闭环、无新增 Critical/Important；报告“popup 均连接”的不准确表述已纠正，实际为 trigger 连接、popup 引用非空以及双重归属检查。最终跨组件整合审查也已通过，未发现 Critical/Important。
- 局部 10 文件、165 测试通过；主代理全量 `SKIP_FREE_API=true pnpm run test`：347 文件通过、1 文件跳过；3372 通过、4 跳过，退出 0。先前 Shadow Esc 全量失败用例现已通过。fork 配置另跑 64 文件、507 测试通过。
- `pnpm run lint`、`pnpm run fmt:check`、`node scripts/pack.mjs test --edition cn` 均退出 0；测试后端正向校验通过，ZIP CRC 通过。保留既有 jsdom navigation、Vite native config 和大 chunk 提示。
- 最新 selection.js SHA256：`f9965c8ae2fa12ab603bcbceaf39fae300310492fa632fde58e0c1ec4d289a8e`；最新 ZIP SHA256：`da3a7fa7b434d053b6994af058be3a071316edd74d780dc5bafdd1822f3eca43`。这两个值替代第一轮构建用于后续部署核验。
- 刷新索引后原始 detect_changes：23 tracked 文件、102 符号、low，已读取全部返回标志，无 partial/truncated/error；不将索引已有执行流采样截断解释为无风险。
- 主 Chrome 仍被锁屏阻断，最新包未部署，真实 Tab 与连续三轮实页验收仍未完成；自动测试未逐项补齐的边界也在上表明确保留，不宣称完整目标已达成。

### 收尾证据复核

- 测试覆盖补充批次局部 174 项通过，但不能据此扩大通过结论：独立复核发现第二周期外部点击测试在完整鼠标序列后再次显式 focus outside，会覆盖潜在错误返焦。该项判为测试证据 Important；现已删除补偿，保留严格深层焦点断言。
- 删除补偿后的外部点击定向测试 ordinary/Shadow 两项通过；随后整个局部目录 177 项中 176 通过、1 失败，失败为 Shadow outside 深层 activeElement 期望 outside、实际 null。该路径存在执行顺序相关差异，尚未确定是 jsdom 装配干扰还是产品缺陷。保留失败用例，不通过补焦点、跳过或放宽断言制造通过；主 Chrome 解锁后必须实证自然外部点击落点。
- Undo、ABA、旧 finally 与新请求锁的晚到 reject 已与 resolve 分别参数化；10.3 保持未完成，先前全量 3372/4 skip 仅对应第二轮生产修复，不代表当前收尾测试通过。当前未重新宣布全量成功；类型与格式检查仍通过。
- 2026-09-08 收尾连接再次返回 Mac 锁屏；新包哈希未变，加载目录仍是旧包，未绕过锁屏操作浏览器。

### 外部点击测试时序定位（2026-09-08 00:30 后）

- 临时 focus 调用诊断复现了失败顺序：鼠标默认动作已聚焦 outside；随后 Base UI `enqueueFocus.mjs:14` 的开菜单初始化 rAF 又聚焦 search；React 在卸载提交阶段对 shadow host 恢复焦点，最终 `document.activeElement` 为 null。只记录测试 DOM 与调用栈，诊断代码已移除。
- 依赖原代码 `FloatingFocusManager.mjs` 的初始化过程为 layout effect → microtask → rAF。原测试第二次打开后人工 `search.focus()`，不能代表该自然初始化已经完成。
- 最小修改仅替换这一测试前置步骤：等待真实深层 activeElement 等于 search，再执行外部鼠标序列。没有 post-click 补焦点、固定等待、跳过用例或降低最终 outside 焦点断言；生产代码未变。
- 改后局部目录连续三次均为 10 文件、177 项通过，退出 0。独立复核确认原测试证据 Important 闭环，无新增 Critical/Important；通过范围仅限自然获焦后的第二周期关闭。
- 此证据仅验证已打开且自然聚焦完成的菜单。快速打开后立即点外部是否也安全仍未被证明，已加入主 Chrome 必验项；不能因正常路径绿而删除该风险。

### 当前自动验证结论（2026-09-08 00:32–00:34）

- 主代理新鲜全量：347 文件通过、1 文件跳过，3384 测试通过、4 跳过，退出 0；按项目规则设置 `SKIP_FREE_API=true`，保留既有 jsdom navigation 提示。
- fork 配置：64 文件、519 测试通过，退出 0；既有 Vite native config 兼容提示未隐藏。`pnpm run lint`（含类型检查）、`pnpm run fmt:check` 通过。
- 严格 OpenSpec 与 git diff 空白检查通过；原始 GitNexus 检查仍为 23 tracked 文件、102 符号、low，全部 102 符号已读取且 flags=[]。保留前述索引采样与未跟踪文件范围限制。
- 本轮仅修正测试前置条件与文档，生产代码未变化，沿用第二轮构建 SHA；新包仍未部署。10.4 自动验证恢复通过，10.3 中真实键盘行为及 10.5 实页验收仍未完成。

### 已有部署准备

- 目标频道：`https://discord.com/channels/867784605293084702/868146710772326482`。
- 已有加载路径：`/Users/yisen/Downloads/translatebuff-1.3.0-test-chrome`；本轮读文件确认仍为修复前 selection.js SHA256 `dff6051f702265424fc8a3b80254d551d68919f82f53104da87dceded8cb15af`。
- 2026-09-07 本轮 CUA 首次检查返回 Mac 已锁定且无法自动解锁。没有操作草稿或插件 UI；后续完成自动验证后重试连接。不得据此把浏览器用例标成通过。
- 部署前备份现有文件夹，不删历史备份；保持插件 ID、登录态和设置。构建命令 `node scripts/pack.mjs test --edition cn`。
- 已备份现有加载文件夹到 `/Users/yisen/Downloads/translatebuff-before-focus-handoff.5sdPT3/translatebuff-1.3.0-test-chrome`，递归 diff 退出 0。尚未替换加载目录或操作重载；历史备份也保留。
- 已知实际 Google 服务的局部阻断规则为 `*://translate-pa.googleapis.com/*`；必须观察真实 blocked 请求才计作失败模拟。测试结束仅删除测试自建规则，核验原有条件、关闭测试 DevTools，并恢复当时实际读取到的用户草稿。
- 新增必验：第二次打开菜单自然聚焦后外部点击，以及快速打开后立即外部点击，两种时序均不得把焦点拉回菜单/消息框；原生 Tab 单独验证，不能用 jsdom 人工 focus 替代。

## 主 Chrome 新包实证（完成，保留中途锁屏记录）

- 已确认原草稿为「你好」并保留恢复目标。现有加载目录与备份递归 diff 一致后，以新包覆盖该目录；manifest 权限未扩大，selection SHA 为 `f9965c8ae2fa12ab603bcbceaf39fae300310492fa632fde58e0c1ec4d289a8e`。扩展页明确显示「已重新加载」，随后 Discord 页面刷新，原草稿仍在。
- 连续切换：草稿「你好，今天我们一起探索新的地图。」三空格转英语后，分别切日语、俄语、韩语；鼠标和菜单 Enter 均成功，原消息框保持焦点，不补点写回。日语阶段现场捕获 pending（选择器禁用、翻译中）与随后完整译文截图。搜索只改变菜单输入，没有污染草稿。
- 首次失败：对 Google 接口新增唯一局部规则 `*://translate-pa.googleapis.com/*`，新草稿触发失败。连续三次 Retry 均回焦原框、显示 pending 并恢复错误提示。后台确认 12 affected，即首次请求及三次 Retry 的各三次底层请求均为 `(blocked:devtools)`。停用该规则后再 Retry，完整英语直接写回。
- 键盘与外部焦点：第一次 Esc 关菜单后焦点为语言 trigger，Undo 仍在；Tab 从菜单到 Undo；菜单关闭后 Esc 结束条。正常外点 Discord 搜索框后焦点留在那里，原框回焦可恢复条。连续三轮快速开菜单后直接点击该搜索框（两次 CUA 原生点击之间无显式等待）也未回拉；这是工具可执行的人类交互速度，不宣称覆盖同一帧内所有时序。
- 重译失败连续三轮：英语成功译文切日语被阻断后，每轮语言回退英语、英语草稿不变、Undo/Retry 可用；Retry 清除错误且保持英语/原框焦点。后台 affected 从 12 增至 21（每次日语请求三次底层尝试），英语 Retry 未增加该计数，符合缓存返回现象；不宣称英语 Retry 新发网络请求。
- 慢请求进行中：创建可识别临时 profile「Codex focus test temporary」，10 Mbit/s 上下行、10000ms 延迟；仅应用于同一 Google 域规则，未修改全局网络条件。日语 pending 截图确认菜单已关闭、chooser disabled、翻译中/Undo 同时可见且原框焦点不丢失。测试后须移除规则和该临时 profile。
- 第一轮慢请求最终成功写入「今夜は青い地図を持って、森の入り口で仲間たちを待ちましょう。」，没有任何额外回焦动作。第二轮打开俄语菜单并成功搜索后，执行菜单 Return→外点 Discord 搜索框→读取状态的调用途中 Mac 锁屏，返回无法自动解锁；随后重新 getState 仍锁屏。不能确定该调用中哪些动作已完成，也不能判第二轮失焦暂存通过。
- **清理尚未完成**：Google 单域名 10 秒延迟规则和「Codex focus test temporary」profile 仍需移除，原草稿「你好」仍需恢复，测试 DevTools 仍需关闭。未发送消息；未修改账号、登录态或全局网络/缓存原有设置。解锁后应优先清理，再按实际草稿状态继续剩余用例。

## 最终完成标准

新代码的自动回归与真实主 Chrome 阻断用例均通过才可关闭本修复目标；任何一次实页失败须继续定位、修订工件、修复和重新验证。原有 8.6/8.8 主题矩阵、未实测的模型风控/会员错误以及发送消息路径不得顺带宣称完成。

### 最后解锁补验与清理（2026-09-08）

- 主 Chrome 为 juntao 配置，任译喵 1.3.0（rf 1.46.6），扩展 ID `jddidboonfbpeocbggfbmlfgacmcfboh`；实际加载目录为 `/Users/yisen/Downloads/translatebuff-1.3.0-test-chrome`。验收页面为 ELDEN RING 的 `https://discord.com/channels/867784605293084702/868146710772326482`。
- 先移除先前 Google 10 秒规则，确认 `Nothing throttled or blocked`；删除 `Codex focus test temporary`，界面确认 `Item has been removed`。后台保留的慢日语请求实际为 `200 OK`、10.14s，之前没有额外回焦即完成写回。
- 编辑后撤销：将日语译文全选替换为「修改后的译文，新增内容。」，点击 Undo，恢复「今晚一起在森林入口等待朋友，带上蓝色的地图。」，而非用户改过的译文。
- 真正失焦暂存：新原文「下一站我们在河边的小屋集合。」三空格译为 `We'll meet at the cabin by the river next.`。为同一 Google 单域临时应用内置 3G 条件，选择西班牙语后立即点击 Discord 搜索框。后台确认 `200 OK`、2.03s；返回 Discord 而不点击编辑器时，焦点仍为 `Search ELDEN RING`，旧英语仍在且条隐藏。仅在随后主动回到原框时，写入 `Nos encontraremos en la cabaña junto al río.` 并恢复条。
- pending 撤销：从该西班牙语会话选择法语，立即点 Undo，原文「下一站我们在河边的小屋集合。」恢复且条结束。后台法语请求随后 `200 OK`、2.01s；返回页面原文仍在，没有晚到译文覆盖。
- 最终清理：移除最后的单域 3G 规则，再次确认 `Nothing throttled or blocked`；全局保持 `No throttling`，保留进入测试时已勾选的 `Disable cache`。没有留下新增配置档。关闭测试 DevTools，恢复用户原草稿「你好」，最后原始截图与 AX 均确认该草稿及原框焦点，没有内联条；未发送聊天消息。
- 证据方式：CUA 原生鼠标/键盘、实际 AX 焦点、原始截图及服务工作线程 DevTools 网络记录。截图保存在本会话工具结果中，未另行归档为 PNG；未使用 DOM 脚本伪造成功。快速开关三轮覆盖原生交互速度，不等价于同一帧竞态的穷尽证明。

本轮完成链：开发计划与工件 → 架构评审 → 红绿实施与代码复审 → 全量自动验证 → 新包身份与重载核验 → 原始阻断/失败/慢请求实页验收 → 测试状态清理。任务 9.7、10.3、10.5 据此完成；整个变更为 72/74，剩余 8.6、8.8 仍待主题专项验收。代码和文档保持未提交、未推送、未归档，留待用户检查。
