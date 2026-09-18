## 1. 基线与来源准备

- [x] 1.1 核对工作区、HEAD 和 upstream-baseline.json，保存用户既有改动状态；逐项核对 upstream-fixes.md 的 15 条决策。
- [x] 1.2 配置或验证官方 upstream 地址，fetch 固定官方 main；验证 12 个完整 SHA 可解析且属于官方历史，记录原始 diff、文件清单与 changeset。
- [x] 1.3 对计划修改符号执行 GitNexus impact，记录调用者、流程和风险；HIGH/CRITICAL 先报告，UNKNOWN 结合实际消费者补查。

## 2. 来源账本与门禁基础

- [x] 2.1 在边界脚本现有测试目录增加多来源共享文件、错误 hash、重复路径、未知来源、路径越界及删除文件状态用例，确认旧实现不能满足新契约。
- [x] 2.2 在 scripts/check-fork-boundary.mjs 实现账本结构和最终内容校验，固定删除文件的明确表示及测试，保持通用 allowlist 不被扩大。
- [x] 2.3 增加官方来源、对象缺失、Git 退出码 128、错误 remote、未触及但已过期来源测试；实现分类前完整预检并区分官方最新引用与完整同步基线。
- [x] 2.4 更新 .github/workflows/fork-guard.yml 的固定官方 fetch 和校验顺序，验证干净环境缺少来源对象时可正确准备、网络或 Git 失败时关闭门禁。
- [x] 2.5 更新 FORK.md，记录本期例外、完整 merge 后清理、工作区与提交检查范围及多来源撤销步骤。

## 3. 站点规则与公式链路

- [x] 3.1 为 Alibaba RFQ Details 正文增加提取回归样例并移植 0e21ebf 的规则，验证正文进入翻译流程。
- [x] 3.2 移植 0f5e158 的 site-rules 类型、解析和 DOM 原子提取；运行公式/KaTeX/MathJax 提取与清理测试。
- [x] 3.3 移植公式恢复、token 审计、translation-modes 与 CSS，测试正常、缺失、重复、新增 token 及恢复原文。
- [x] 3.4 适配 src/utils/prompts/translate.ts 与 src/fork/page-translation/llm.ts，测试实际 JSON 批处理提示词收到 token 保留指令。
- [x] 3.5 在后台 translation-queues.ts 与 translate-text.ts 共用缓存准入规则，增加两个缓存均拒绝异常且接受合法 sentinel 的回归测试。
- [x] 3.6 运行实际 fork 队列注入、结构化批量、旧版和单条路径测试，验证错误响应不会在第二次请求命中污染缓存。
- [x] 3.7 移植 fcb54e0 的 arXiv 标题修复，验证译文不重叠且恢复正常。
- [x] 3.8 移植 94201a3 的 Substack 完整播放器排除，验证正文仍可翻译；检查累计 rules.json 未覆盖前述来源。

## 4. 配置与实际交互入口

- [x] 4.1 移植 9ae2760 的配置函数式更新与 entity-config，测试独立字段并发更新不互相覆盖。
- [x] 4.2 移植 autosave-controller、use-autosave 及字段组件，运行 IME 中间态、结束态和无效 JSON 草稿测试。
- [x] 4.3 接入 autosave-navigation 与 options 路由，验证有效草稿导航保存及无效草稿处理，适配 JSON 编辑器现有 lint 上下文。
- [x] 4.4 验证实际 fork 自定义动作保存与提供商设置只读行为，区分共享编辑器测试和实际入口证据。
- [x] 4.5 移植 0284b5a 的空闲划词覆盖层修复，适配两个 fork selection controller 的 atom 消费者，验证触摸透传和动作调用。
- [x] 4.6 移植 03c3a86 并适配 fork popup 的 getTranslationOnlyBlockedReason，测试禁用提示和合法切换。
- [x] 4.7 移植 77df090 并适配实际 fork floating-button，测试折叠外部区域透传和按钮命中。
- [x] 4.8 对实际重定向文件逐一审查差异，仅在适配与测试通过后更新 redirect-baseline.json。

## 5. 字幕与提示词

- [x] 5.1 移植 ba71eba 的 db-cleanup 与同步 alarm 注册，测试七天前、边界、未到期分句缓存及 alarm 触发。
- [x] 5.2 移植 5141886 的 YouTube 控制条高度、嵌入选择器与可见性修复，运行标准、嵌入及迷你播放器测量测试。
- [x] 5.3 核查 YouTube 平台共享文件未引入 7ca0122 的延期 AI 转录逻辑，隐藏入口和原生字幕行为保持原契约。
- [x] 5.4 移植 a250e6c 的保留名称判断，测试实际 fork 提示词对 sentinel、代码和外语正文的约束。
- [x] 5.5 移植 a6384f6 的分句长度优先及短 cue 例外，测试累计 prompt.ts、subtitles.ts 同时保留其他来源修改。

## 6. 累计账本与撤销验证

- [x] 6.1 审查全部 12 条来源与本地适配 diff，生成 selective-upstream-patches.json 的真实来源、唯一文件条目和最终累计 hash，保留必要删除记录。
- [x] 6.2 验证 rules.json、prompt.ts、subtitles.ts、locale 和共享测试的多来源关系；确认三条延期及其余建议未进入 applied 清单。
- [x] 6.3 在临时测试仓库模拟共享文件单来源撤销和后续完整 merge，确认剩余补丁保留、过期账本失败及清理后通过。
- [x] 6.4 保留 12 个上游 changeset，检查包名与 conventional commit 内容，按需补充 fork 适配 changeset；确认未升级版本、依赖和完整同步基线。

## 7. 综合验收与交付证据

- [x] 7.1 设置 SKIP_FREE_API=true，运行定向回归、root 测试和 pnpm run test --config vitest.fork.config.ts src/fork；记录外部 free-api 测试为有意跳过。
- [x] 7.2 运行 pnpm run type-check、pnpm run fmt:check 和 Chrome/Edge/Firefox 构建，修复本期引入的问题。
- [x] 7.3 运行品牌、域名隔离、产物及边界检查，明确被检查的工作区或提交范围，不能以默认 base...HEAD 证明未提交改动已覆盖。
- [x] 7.4 用真实 Chrome 验证触摸轮播、悬浮按钮、划词/自定义动作、popup 提示、设置 IME 与导航，并保存结果。
- [x] 7.5 用真实 Chrome 验证公式翻译与恢复、Alibaba/arXiv/Substack 页面和 YouTube 迷你播放器；保存样例及结果。
- [x] 7.6 经现有实际网关验证 sentinel 和 AI 分句样例，记录输入、结果与限制；未执行时如实保留未验证状态。
- [x] 7.7 将各项实现路径、适配差异、测试证据及撤销边界填入 upstream-fixes.md；核对规格场景和实际 fork 路径均有覆盖。
- [x] 7.8 执行完整无截断 GitNexus detect-changes 与最终 diff 审查；若进行提交，必须在提交前完成图变更分析。
