# 实施证据

## 起点

- 实际 HEAD：73dee1dbd21658325c18e5766e6ab3023fc48d07；相比规划基线新增两条设置主题提交，保留全部现有代码。
- 起始工作区只有本变更规划目录未跟踪，无已有业务未提交改动。
- 完整同步基线仍为 02ad422c1e1260960e141e4012a20d93e85082aa / 1.46.6。
- 已配置固定官方 upstream 并 fetch main；12 条来源逐一 cat/rev-parse 与祖先校验通过。sources.json 和同目录 patch 保存原始来源及路径。

## 门禁测试

- 新账本测试初次运行：3 项失败，缺少 validateSelectivePatches；实现后 33 项通过（含旧边界测试）。
- 官方来源测试初次运行：1 项失败，缺少 verifySelectiveSource；实现后两个文件共 39 项通过。
- 命令：SKIP_FREE_API=true pnpm run test `scripts/__tests__/selective-upstream-patches.test.ts` `scripts/__tests__/check-fork-boundary.test.ts`。
- 删除文件表示固定为 deleted: true，禁止同时出现 sha256，要求文件确实不存在；普通文件使用 LF 归一化 sha256。
- classifyChangedFiles impact：LOW，直接调用者为脚本文件入口，无关联执行流程；完整来源符号分析另存 impact 目录。

## 综合验证

- root：3700 passed，4 项有意跳过，设置 `SKIP_FREE_API=true`；见 root-tests-final.log。
- fork：747 passed；见 fork-tests-final.log。账本与边界定向测试最终为 40 passed。
- type-check、fmt:check、Chrome/Edge/Firefox 构建、品牌与三种产物域名检查通过。
- 工作区边界检查无违规，见 worktree-boundary.json；默认历史 base...HEAD 检查存在既有差异，不能代替本次工作区检查。
- graph-changes.json 保存完整结构化图分析，179 个符号、75 个流程、风险 CRITICAL，无 partial/truncated 标记。索引刷新受 GitNexus 安装包身份校验失败阻塞，索引仍有滞后，不能把图结果视为新符号全覆盖。

## Chrome 与真实网关（2026-09-18）

- 用户在独立测试 Chrome 手动登录，扩展已同步登录凭据；未保存或输出凭据。
- chrome-smoke.json：真实 Chrome 触摸轮播产生 pointerdown/move/up，无 pointercancel；空闲覆盖层无面积，悬浮容器 pointer-events 为 none，页面点击正常。
- browser-autosave.json：真实 Edge 设置页面的合成 CompositionEvent 验证 IME 中间态不保存，结束并导航后保存。此证据不能替代 Chrome 全部交互验收。
- chrome-gateway-pages.json：在真实 Chrome 使用受控站点域名 HTML fixture，公式、Alibaba、arXiv、Substack 均进入翻译流程；Substack 播放器排除生效，关闭翻译移除 wrapper，原始 MathML 保留。
- 上述 wrapper 是错误容器，不能判定译文成功。通过扩展实际 enqueueTranslateRequest 调用确认网关 HTTP 401：该令牌额度已用尽。见 gateway-blocker.json。
- 公式译文保留、arXiv 译文行高、Substack 正文译文、sentinel 与分句网关样例尚未通过真实网关验收。YouTube 迷你播放器及 Chrome 其余交互仍待验收；对应任务保持未勾选。
- 测试修改的翻译提供商配置已恢复。测试 Chrome 保持打开，供用户恢复测试额度或切换测试账号。

## 测试环境最终验收（2026-09-18）

前述生产账号额度阻塞已通过切换测试环境解决；生产错误不能代表测试账号额度。使用 `pnpm exec wxt build --mode testsite` 构建 `.output/chrome-mv3-testsite`，用户在测试 Chrome 登录测试站 0012，确认扩展同步成功。生产扩展在此测试窗口禁用，生产构建文件未覆盖。

- `chrome-testsite-gateway-pages.json`：真实扩展、真实测试网关，页面使用受控域名 HTML fixture（不是四个站点的线上页面）。公式译文保留 MathML；恢复后只剩原始一份 MathML。Alibaba 正文中文译文成功。arXiv 字号 24px、译文行高 36px，恢复后无 wrapper。Substack 播放器原文不变，正文翻译成功并可恢复。
- `chrome-autosave.json`：真实 Chrome 设置页合成 CompositionEvent，中间态仍为 Custom AI Action，compositionend 后导航保存“上游验收草稿”。并非操作系统输入法端到端测试。
- `chrome-selection-action.json`：真实页面鼠标选词，实际 fork 划词翻译和自定义动作均返回中文；截图为真实 UI。
- `chrome-popup-mode.json`：微软提示明确、点击后仍为 bilingual；切换兼容提供商后可进入 translationOnly。测试后恢复模式/提供商。
- `chrome-youtube-measurement.json`：真实 Chrome 布局 fixture 执行实际 getYoutubeConfig 源码，标准/嵌入测量 59px，根部杂散进度条父级 495px 不影响测量，autohide 可见性正确。
- `chrome-youtube-live.json`：真实 YouTube 进入迷你播放器再展开，实际源码在真实 DOM 测量；展开后根部残留进度条父级高 461.25px，而控制条测量为 59px。当前视频无可用原生字幕，未声称验证字幕内容或 AI 转录。
- `testsite-gateway-samples.json`：默认模型保留名称、正文翻译成功，但代码请求超时、分句返回 504，保留失败记录。
- `testsite-gateway-deepseek-samples.json`：同网关 DeepSeek 可用模型返回原样名称和代码、中文外语正文；分句保留静音两侧的重复句，200ms 短词与相邻句合并。本组没有返回字面 sentinel，因此只证明本组无需翻译内容保持原样，不证明模型必然输出 sentinel；sentinel 协议处理由确定性测试覆盖。单次模型样例不能证明所有输入。
- 最终 `graph-changes-final.json`：179 符号、75 流程、136 文件、CRITICAL，无 partial/truncated 标记；索引刷新工具错误的限制仍适用。
- simplify 审查聚焦 fork 适配与门禁，缓存规则和禁用原因已共享，未发现需要新增抽象或行为改动；保留官方补丁的来源与结构。未提交、未归档。

## 归档与提交检查

2026-09-18 用户授权提交并归档。三份增量规格已逐条同步并比对主规格，19 份主规格校验通过。新增两份主规格按同步技能保留 TBD Purpose，待后续完善能力说明。归档 CLI 在 Windows 返回目录重命名 EPERM，随后校验绝对路径均在工作区内，使用 PowerShell Move-Item 完成相同归档目录移动，保留 .openspec.yaml 与全部证据。

归档后工作区边界检查：12 来源、113 账本文件、无违规；提交前重新执行完整图分析（详情见 graph-changes-final.json），图索引刷新限制仍见前文。此前“未提交、未归档”描述为实施阶段记录，本节为归档阶段补充。
