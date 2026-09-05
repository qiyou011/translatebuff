# fork 迁移验证（2026-09-05）

## 范围与结果

用户确认采用 fork 自持方案。业务实现及测试位于 `src/fork/ui/selection-content/input-translation/`，fork App 只挂载一次该 hook。引擎、配置、provider、输入替换协议及注入脚本继续复用上游。

以下四个文件与已同步上游 `02ad422c1e1260960e141e4012a20d93e85082aa` 完全一致：

- `src/entrypoints/selection.content/input-translation/use-input-translation.ts`
- `src/entrypoints/selection.content/input-translation/index.ts`
- `src/components/language-combobox.tsx`
- `src/components/ui/base-ui/combobox.tsx`

九语独立文案块保留。无新的重定向、allowlist、schema 或迁移变更。本次仅重构，不另增用户可见功能 changeset；既有三份修复记录保留。

## 自动化证据

- 漂移哨兵：恢复前 4 个哈希断言均失败，恢复后 4 个均通过；必须先移植适用上游修复再人工更新指纹。
- 专用菜单替换前：10 个 Portal/菜单事件测试失败；替换后 9 文件、94 个功能测试全部通过。
- `WXT_WEBSITE_URL=https://www.readfrog.app WXT_OFFICIAL_SITE_ORIGINS=https://readfrog.app,https://www.readfrog.app SKIP_FREE_API=true pnpm run test`：3298 通过，4 跳过；345 测试文件通过，1 文件按要求跳过。已有 jsdom navigation 提示，不是失败。
- `pnpm run type-check`：通过。
- `pnpm run build`：Chrome production 构建通过；保留已有大于 500 kB chunk 告警。
- `git diff --check`、本次文件格式检查、OpenSpec 严格校验：通过。
- 独立只读代码审查：无 Critical / Important / Minor；审查者另跑 94 项功能测试通过。

GitNexus 已更新当前仓库索引。为纳入未跟踪的 fork 文件，使用隔离的临时 Git index 做变更分析，未暂存用户工作区：29 文件、155 符号。索引器提示全仓流程枚举存在预算裁剪，因此“0 affected processes”不代表没有运行时影响；调用边界另以定向 impact、源码引用、行为测试及浏览器验证确认，不据此宣称全仓无风险。

## 真实 Chrome 生产构建验证

- Chrome：152.0.7977.76，全新独立临时 profile，未读取用户登录资料。
- 产物：`.output/chrome-mv3`，扩展 ID `jjgoechanghiknlblangmfijblhggkdl`。
- `content-scripts/selection.js` SHA-256：`b2857ca5e7422dfc2f79b5b41575bb55015a7d798950c413ac0056c296d2d425`。
- 页面：本地 HTTP 泰语测试页，包含会在冒泡 keydown/paste 时抢输入框焦点的宿主监听。**不是 Discord 实页**。
- 使用真实 `microsoft-translate-default` 翻译服务，未 mock 翻译结果，未注入替代的扩展实现。

通过的操作：

1. 输入“你好，今天很高兴见到大家。”并真实按三次空格，结果为“สวัสดีค่ะ ยินดีที่ได้พบทุกคนวันนี้”，出现泰语内联条。
2. 点击外部控件隐藏，重新聚焦原输入框恢复内联条。
3. 菜单向上展开，搜索 `eng` 时焦点留在菜单、草稿不变，宿主 keydown 抢焦点计数为 0。
4. 菜单打开时测试页从深色切为浅色，主题更新，搜索内容、焦点、会话保留。
5. 方向键导航后明确选中英语并按 Enter，真实重译为“Hello, it's a pleasure to see you all today.”，标注“手动选择”。
6. 编辑译文后撤销，恢复最初中文原文并关闭内联条。
7. 再次翻译后，第一次 Esc 只关菜单，第二次 Esc 结束会话；失焦后重新聚焦不复活旧条。
8. 页面 `pageerror` 记录为空。

测试脚本曾因 Shadow DOM selector 语法失败，随后修正为 Puppeteer `pierce/`。另一次 `eng` 搜索匹配英语及壮语，向下键实际选中壮语；最终脚本记录真实高亮项并明确选中英语，以上结果来自最后一次全新 profile 完整通过的运行。未据此修改产品语言列表或过滤语义。

证据目录：`/Users/yisen/.codex/visualizations/2026/09/02/01a06139-72f0-7f00-ab7e-141a224eb680/`。

- `fork-migration-browser-evidence.json`：逐步 DOM 状态、构建指纹及浏览器信息。
- `fork-migration-translated.png`：真实泰语翻译完成。
- `fork-migration-menu-dark.png` / `fork-migration-menu-light.png`：真实菜单深浅主题截图。
- `fork-migration-undo.png`：编辑后撤销恢复中文原文。

临时浏览器与 HTTP 服务已关闭，最终临时 profile 已清理。截图为原始页面捕获，不是拼接图。

## 首轮未完成与边界（后续主 Chrome 复验见下）

- 用户默认 Chrome 实例连续报告用户操作中断控制，网页连接也超时。本轮没有完成登录态 Discord 实页重验，不能替代任务 8.8；未发送任何聊天消息。
- 本轮不宣称覆盖真实 IME、系统剪贴板粘贴、窄窗口/长名称、所有文字实测对比度或 Edge/Firefox。既有任务 8.6、8.8 保持未完成。
- 当前工作树特性文件集按 fork 分类器核验，源码违规为 0，但既有 `.changeset/calm-keys-search.md`、`quiet-otters-undo.md`、`tidy-geese-theme.md` 仍与 fork 门禁策略冲突。AGENTS 要求用户可见修复带 changeset；未删除记录、未放宽门禁。任务 6.3 保持未完成。
- 未提交、推送、合并或归档，用户工作区与实际 Git index 保留。

## 主 Chrome / Discord 实页补验（2026-09-05）

用户明确要求使用主 Chrome，因此本轮保留 `juntao` profile、现有登录和配置，不使用临时 profile 或本地模拟页。通过原生 Chrome UI 操作，未发送聊天消息。

### 最新产物确认

- Chrome 扩展详情页确认原扩展 ID 为 `lmegaogaablpadepipagnlfdepkncpdh`，加载来源为本仓库 `.output/chrome-mv3-dev`。
- 原开发产物早于 fork 文件迁移。重启本项目 WXT dev server（`pnpm dev`），5.227 秒完成全量开发构建，再点击 Chrome 扩展「重新加载」并刷新 Discord，避免沿用旧内容脚本。
- 本次产物是 **development unpacked**，不是 production 包或商店安装，也不是清空配置后的首次安装。
- 最新 `content-scripts/selection.js` 构建时间：`2026-09-05T06:35:32.690Z`；SHA-256：`c0afdda2867245d54fa3ab84a3977be42f20616d77010905b6573026f30f40a7`。
- 构建内容包含 `src/fork/ui/selection-content/input-translation/use-input-translation.ts` 和专用 `input-translation-language-select.tsx` 源模块路径。
- 页面：`https://discord.com/channels/1310892846395428946/1486262590702092338`，真实登录态、泰语频道、现有深色主题。

### 实测结果

| 场景               | 实际观察                                                                                                    | 结论                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 三空格触发         | 先核对输入为“你好，今天很高兴见到大家。”，实际按三次空格，替换为“สวัสดีครับ ยินดีที่ได้พบทุกคนในวันนี้ครับ” | 通过                               |
| 对话语言检测       | 内联条显示泰语、“自动检测”；当前 Discord 界面仍为英语                                                       | 通过                               |
| 失焦与重新聚焦     | 点击消息区域后条体消失；重新点击同一草稿框，条体和撤销入口恢复，译文不变                                    | 通过                               |
| 语言菜单搜索       | 鼠标点搜索框，真实按键输入 `e`、`n`、`g`，结果过滤为英语和壮语，消息草稿没有增加搜索字符                    | 通过                               |
| 搜索框粘贴         | 明确使用纯文本格式粘贴 `English`，仅搜索内容变化，列表仅剩英语，草稿不变                                    | 通过                               |
| 菜单方向与深色外观 | 原始 Chrome 截图可见菜单在条体上方，搜索框/列表/条体均为深色，英语高亮可见                                  | 通过（视觉观察，非全项对比度测量） |
| 手动切换重译       | 点击英语，真实结果为“Hello, it's nice to see you all today.”，标注“手动选择”                                | 通过                               |
| 删除、追加后撤销   | 删除英文句号并追加“，这是编辑后的内容”，内联条保留；点击撤销恢复完整最初中文原文，而不是修改后的译文        | 通过                               |
| 清空全部译文后撤销 | 新一轮翻译后选中并删除全部译文，Discord 仅剩空编辑器占位，撤销入口仍存在；撤销恢复最初中文原文              | 通过                               |
| 菜单 Esc           | 菜单打开时第一次 Esc 仅关闭菜单，内联条仍在                                                                 | 通过                               |
| 会话 Esc           | 第二次 Esc 关闭条体；点击外部再聚焦草稿，不复活已结束会话                                                   | 通过                               |
| 清理与草稿恢复     | 恢复开始时实际读取到的草稿“你好”，确认内联条已关闭                                                          | 通过                               |

证据来自本轮 CUA 原生 Chrome accessibility 状态和工具返回的原始截图（泰语翻译结果、`eng` 菜单搜索结果），不沿用上方本地测试页截图冒充 Discord。操作过程中未使用 mock 翻译、替代事件监听或伪造 UI；当前页面只观察到一个翻译内联条。开发服务器继续运行在 `http://localhost:3333`，供现有开发插件使用。

### 测试工具与未覆盖边界

- 首次未指定格式的原生 paste 曾带入系统剪贴板的富文本链接，部分连续输入操作也未立即生效；这类尝试不计为通过依据。随后明确使用 `format: text`，每个关键步骤先核对实际输入/选区再继续；最终草稿已恢复。
- 额外尝试对泰语草稿再次触发时，仍按配置的来源端与对话目标端重新翻译，并未显示同语言提示。规格中的同语言场景比较的是“对话语言”与“用户配置的目标语言”，不是自动识别当前草稿语言（`resolve-lang.ts`、`use-input-translation.ts`）；本轮没有改变用户语言配置，因此**不计为同语言提示分支已验证**。
- 未测试实际消息发送（避免污染频道）、真实 IME 组合输入、浅色主题/主题切换、窄窗口和长语言名、多输入框/多频道隔离、全部文字对比度、错误/超时路径及主 profile 下 production 安装。任务 8.6、8.8 的完整矩阵仍不能标记全部完成。
- 本轮没有修改产品源码、用户主题/语言配置或账号数据，没有提交、推送、合并或归档。
