# 云准入与渲染依赖审计

- 源码 HEAD：`e1d90dc928ca5fbbbba112e480131e1c909c93ce`。
- 结论：本轮未发现新增可证的云准入导致 options/popup/Hub 整页渲染错误；存在组合级集成回归缺口。禁止据此称全站已回归或 G5 零商业请求。
- 本轮只读生产与测试；未运行产品测试、构建、浏览器、账号或外网；已知三项 UI 修复由主代理处理，不重复复审已修 Note 叶子。

## 图与当前源码边界

- 索引commit=e1d90dc；未提交新空叶子/redirect为盲点，已逐项看当前源码。
- fork-ui-redirect是构建解析行为，图里fork导出的0 caller不能用作安全结论；同时跟踪上游同名符号消费者与当前重定向。
- 宽query会混入已生成evidence/unpacked符号，未将这些结果当成当前生产消费者。
- GitNexus status：Repository: /Users/yisen/.codex/worktrees/upstream-sync-v1-51-0/translatebuff；Indexed: 10/15/2026, 5:56:24 PM；Indexed commit: e1d90dc；Current commit: e1d90dc；Status: ✅ up-to-date

## 消费者矩阵

“已覆盖”仅指已有定向测试源加本轮源码检查；这些测试本轮没有执行。

| ID | 功能/API | 分类 | 当前消费者与分支 | 证据 | 剩余边界 |
| --- | --- | --- | --- | --- | --- |
| A01 | 同步拒绝出口与笔记建议遗留hook：resolveNoteSuggestionAction 同步抛 UpstreamCloudDisabledError；拒绝出口保持不变 | 可信源码无当前可见调用 | 图中剩余 maybeFire 只由上游 SelectionTranslationProvider 使用；实际 app shim 挂 fork Provider/controller，fork 目录无 useNoteSuggestion 导入。旧 noteSuggestion.enabled=true 和 local provider 不会重新挂载该上游 hook。已修 NoteSuggestionItems 空叶子仅记索引盲点，不重复审查它。 | `src/fork/upstream-services/custom-actions.ts:46`；`src/entrypoints/selection.content/selection-toolbar/note-suggestion/use-note-suggestion.ts:121`；`src/entrypoints/selection.content/app.tsx:2`；`src/fork/ui/selection-content/App.tsx:14` | 新增页面不得重新 import 上游完整 SelectionTranslationProvider；仍需整页路由回归。 |
| A02 | options/popup provider渲染：resolveProviderRefForCapability 同步返回 local/null，不在渲染期抛禁用错误 | 已覆盖 | 默认/旧 system 无候选为 null；有合格自有候选为 local；显式有效 local 保持。消费者 optional-chain/null 分支，provider picker 过滤 system。noteSuggestion 从功能清单排除。 | `src/fork/upstream-services/provider-registry.ts:20`；`src/fork/ui/options/feature-providers-config.tsx:49`；`src/fork/ui/options/feature-provider-selector-list.tsx:56`；`src/fork/ui/popup/providers-field.tsx:39`；`src/fork/components/provider-selector.tsx:77`；`src/fork/components/provider-selector-groups.ts:28` | 现有测试证明解析/选择器叶子契约，不代替所有 options 路由在三类配置下实际挂载。 |
| A03 | 页面provider同步throw及serialize异步拒绝：resolvePageTranslationProvider 可同步抛；serializeProviderRef 可异步拒绝；OrNull/checkProviderAvailability 转 null/available:false | 可信源码无options/popup/Hub渲染期调用 | 图+全文搜索定位调用在翻译任务/页面启动路径，非 options/popup/Hub 渲染。PageTranslationManager 先 validator/OrNull/availability，再在 try 内用抛异常版。 | `src/fork/upstream-services/provider-ref.ts:25`；`src/fork/upstream-services/provider-ref.ts:33`；`src/fork/upstream-services/provider-ref.ts:82`；`src/entrypoints/host.content/translation-control/page-translation.ts:268`；`src/entrypoints/host.content/translation-control/page-translation.ts:307`；`src/entrypoints/host.content/translation-control/page-translation.ts:326` | 用户触发任务时的错误UI仍应做集成回归；不将任务内明确拒绝视作整页渲染故障。 |
| A04 | 上游auth与billing/RPC：getSession/useSession 立即空且pending=false；signOut/transport call异步拒绝 | 已覆盖 | 可见账号菜单直接使用自有forkSession，独立于空上游session。上游useUserAccountMenu只在未采用的上游菜单；即被复用，billing query以上游userId门控为空。SDK不会由type-only auth导入初始化。 | `src/fork/upstream-services/auth-client.ts:7`；`src/fork/upstream-services/auth-client.ts:13`；`src/fork/upstream-services/disabled-rpc-link.ts:8`；`src/components/user-account-menu/shared.tsx:183`；`src/fork/ui/popup/App.tsx:27`；`src/entrypoints/options/app-sidebar/index.tsx:12`；`src/fork/ui/options/account-menu-sidebar.tsx:9` | orpc拒绝测试主动关闭Query重试，不能据此称所有未来query消费者自动尊重isRetryable；当前可见云query由入口/空session关闭。 |
| A05 | 托管AI配额/可选provider状态：useHostedAiStatus 同步返回undefined状态、signedIn=false、pending=false | 已覆盖 | 上游API Providers页仍挂usage组件，但实际hook为无query空状态，组件立即null；provider options/status helpers容忍undefined；fork picker不显示system。 | `src/fork/ui/hosted-ai/use-hosted-ai-status.ts:15`；`src/entrypoints/options/pages/api-providers/built-in-ai-usage/index.tsx:88`；`src/components/llm-providers/use-hosted-ai-provider-options.ts:17`；`src/utils/hosted-ai/status.ts:81` | 需要旧hosted缓存+自有已登录配置的页面组合验证，不把自有账号登录当成上游会话。 |
| A06 | Notebase云连接/保存/自动建议：RPC拒绝；resolveNoteSuggestionAction同步throw保持 | 可信源码无当前可见调用 | 云tab React元素被传为prop不等于挂载；fork tabs仅返回config、连接字段本身为空。保存按钮/对话框/hook仅在上游selection providers或NoteSuggestionCard引用；当前forkselection未挂载它们。旧连接enabled或自有key不改变这些静态入口。 | `src/fork/ui/options/custom-action-editor-tabs.tsx:5`；`src/fork/ui/options/notebase-connection-field.tsx:5`；`src/fork/ui/selection-content/SelectionCustomActionProvider.tsx:17`；`src/fork/ui/selection-content/use-custom-action-controller.ts:8`；`src/components/custom-action/use-save-to-notebase.ts:81` | UI编辑器布局/自动保存为其他审计范围；本审计不把云tab关闭等同于自定义动作完整交付。 |
| A07 | Google Drive授权/同步：Drive原件保留OAuth/fetch；产品入口为空，非通用domain封禁 | 可信源码无当前可见调用 | 全文搜索+图显示useGoogleDriveAuth只来自被替换Drive卡和该卡子dialog；当前没有其他可见导入。搜索入口过滤。未发现后台启动Drive。 | `src/fork/ui/options/google-drive-sync-card.tsx:6`；`src/entrypoints/options/pages/preference/config/index.tsx:5`；`src/fork/ui/options/search-items.ts:7`；`src/hooks/use-google-drive-auth.ts:19` | 未声称所有原始Drive导出请求均有本地拒绝；若将来新增直接服务消费者，需重新审查入口、初始化及请求边界。 |
| A08 | 博客通知：getLatestBlogDate异步返回null，入口空叶子不query | 已覆盖 | 图原queryFn消费者分别为popup通知和options footer，均被替换为空；旧query缓存也没有可见显示入口。 | `src/fork/upstream-services/blog.ts:9`；`src/fork/ui/popup/blog-notification.tsx:3`；`src/fork/ui/options/whats-new-footer.tsx:3` | 无本轮新增已证问题。 |
| A09 | AI转录/学习侧栏/Netflix/X：requestAiSubtitles/requestVideoSummary/Netflix fetch/adapter执行异步拒绝，ability=false，mount nil | 已覆盖 | options视频字幕配额卡为空；字幕设置中的转录和侧栏项为空、adapter能力false；sidebar host不创建；X/Netflix在实际初始化前准入阻断。原生字幕、既有AI分段属批准能力，未被整体关闭。 | `src/fork/upstream-services/video-adapter.ts:7`；`src/fork/upstream-services/video-adapter.ts:11`；`src/fork/upstream-services/subtitles-sidebar.ts:4`；`src/fork/ui/subtitles/ai-quota.tsx:7`；`src/fork/ui/subtitles/request-ai-subtitles-item.tsx:9`；`src/fork/upstream-services/ai-subtitles-access.ts:3`；`src/entrypoints/subtitles.content/runtime.ts:16`；`src/entrypoints/subtitles.content/runtime.ts:17` | 设置aiSegmentation=true的正常字幕LLM路径不应作为转录商业泄漏误报；未做本轮实包平台回归。 |
| A10 | 后台冷启动/pending/status/summary消息：setup保持契约；状态null、pending处理器不启动；summary保存明确拒绝 | 已覆盖 | 背景初始化通过重定向进入无业务副作用setup；旧pending数据不读取/删除；直接消息调用结束。 | `src/entrypoints/background/index.ts:141`；`src/entrypoints/background/index.ts:156`；`src/entrypoints/background/index.ts:36`；`src/fork/upstream-services/notebase-pending-save.ts:7`；`src/fork/upstream-services/hosted-ai-status.ts:10`；`src/fork/upstream-services/video-summary-background.ts:7` | 当前静态审计不能替代SW/扩展页/content三上下文G5网络归属验收。 |
| A11 | options默认/旧配置/自有登录态路由组合：覆盖页面级依赖组合，不改拒绝出口 | 需集成回归 | 现有定向测试多为叶子或resolver，不能证明所有路由渲染、初始化、切换/旧缓存组合都已经执行。当前未证实第二处云准入导致整页错误。 | `src/entrypoints/options/app.tsx:4`；`src/fork/ui/popup/App.tsx:22`；`src/fork/ui/translation-hub/translation-card.tsx:54` | 见integrationRegressionPlan；本轮禁止运行测试/浏览器，因此保持待验，不记失败。 |

## 需集成回归

现有叶子测试无法替代如下页面组合；保持为待验，不把未执行项记作通过或失败。

- **I01 全部options路由、popup、Hub**：上游DEFAULT_CONFIG；schema迁移后的旧云设置true/system引用，含noteSuggestion/builtIn/cloud连接；自有已登录且有合格local模型；自有登录但无key/候选被禁用。完成标准：加载真实redirect，挂载/路由切换无未捕获render错误；禁用功能不可见且不调用同步throw/API；正常dictionary/custom actions可见且不被整体禁用。
- **I02 custom action深链及持久化页面状态**：default-sentence-analysis/default-improve-writing深链；tab=notebase旧页面；dictionary及正常自定义动作。完成标准：未批准动作不挂载编辑器/不生成；notebase不挂query；批准动作保留编辑与正常provider选择。
- **I03 API providers/一般设置/视频设置**：旧hosted状态缓存；自有已登录；普通MT和自配local provider。完成标准：无上游login/billing/quota/转录入口或初始化；自有模型、正常MT和已批准字幕AI分段仍可用；禁用错误不演变持续loading。
- **I04 后台冷启、扩展页、content**：旧pending任务；旧cookies/hosted缓存；真实有效自有provider对照。完成标准：独立记录三执行上下文网络归属；本静态审计不出零商业请求结论。

## 新增产品问题

无新增可证问题；不解除任何本地拒绝出口，不把隐藏上游源码的图关系误作当前已挂载，不将 `UNKNOWN`/0 caller 记为安全。Drive 原始 API 没有被描述为全导出拦截，只证明本次当前可见挂载链未触达。

## 证据

`admission-audit.json` 保存实际 query/context 返回、当前源码 hash、未提交状态、消费者矩阵与待验计划。图中的上游与 fork 同名符号已分别 disambiguate。既有定向测试列表见 JSON，仅审阅测试源，未重复运行。
