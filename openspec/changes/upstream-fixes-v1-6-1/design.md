## Context

当前分支 `feat/1.6.1`，业务起点 `4b50206132b9f0a09dce9951a928c6fefd99c34e`，包含 v1.51.0 的真实合并关系。已接纳完整同步记录仍为 `02ad422c1e1260960e141e4012a20d93e85082aa / 1.46.6`，不能因代码已合并而跳过前轮待验收并推进记录。

本次使用 TypeScript、React、WXT 和现有 Vitest/fork 重定向测试框架。`wxt.config.ts` 将部分入口、UI 和服务重定向到 `src/fork`；根套件通过不代表用户运行路径通过。现 picker 是旧实现；fork selection App 挂载独立 ToastProvider；官方商店评价入口不在 fork popup 运行路径。

探索阶段用户确认“仅现有功能修复、保留 UI/会员/网关、不引入新功能”，选择逐提交移植。2026-11-02 独立 architect_review 明确“审查通过”，要求保留 picker 语义回迁、Toast provider/context 一致性、选择性分支与增量门禁。不存在设计稿还原任务。

## Goals / Non-Goals

**Goals:** 对 `upstream-fixes.md` 19 条候选逐条得出可复核结论；适配现有执行路径并验证真实用户效果；维持来源、指纹、业务边界和可回退性。

**Non-Goals:** 不合并最新 main，不纳入窗口之外提交，不重写组件/目录/runtime，不升级依赖、schema 或完整同步记录，不开放 Notebase/X/Netflix/AI 转录/新 AI 动作/PDF/电子书，不改 UI 风格、付费体系、批大小/并发/超时，不自动推送发布归档，不替前轮补签验收。

## Decisions

### D1：按来源顺序逐条移植

比较方案为逐提交移植与按模块合并移植。用户选择前者：来源和回退清晰，代价是共享文件可能重复适配。文件最终只保留一份结果，不按来源复制模块。

实施使用 `codex/upstream-fixes-v1-6-1` 隔离分支；必要时建立独立 worktree，并将本变更规划带入该工作树，不丢弃当前未提交文件。记录实施起点、实际目标分支与冻结的增量比较 SHA。目标业务分支为 `feat/1.6.1`；若目标发生业务变更，先重新对账，不覆盖它。

获取官方 main 验真并固定本轮来源上界 `5c5337624f148bd2c62d8d9496c9e5f06d7c7d8f`，核实每条源提交是其祖先、位于 v1.51.0 之后，并判断本仓是否已等价应用。不得根据过时的本地 `upstream/main` 判定最新来源不存在。对照父提交和依赖阅读补丁，再选择受控 cherry-pick 或人工语义移植；冲突逐贡献解决，不批量 take-theirs。

每条候选结果只能为实际移植、部分适配、已有等价、依赖阻断之一；部分适配明确保留/排除效果，依赖阻断不冒充已修复。不能以更新指纹代替核对行为。

### D2：映射实际路径，保持架构

| 范围                | 核对与实施位置                                                                                                                                                                                               | 必须保护的约束                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| P01/P03/P07/P16/P17 | `src/entrypoints/host.content/translation-control/page-translation.ts`、`src/utils/host/dom`、`src/types/config/site-rules.ts`、`src/utils/site-rules`、`src/utils/host/translate/core/translation-state.ts` | 新版 content-runtime 路径映回当前路径；视口懒加载、shadow root、MutationObserver 去重/取消/释放、代码和公式保护。                 |
| P13/P18/P19         | `src/utils/host/translate/text-preparation.ts`、`api/google.ts`、`core/translation-modes.ts`、`core/translation-request.ts`、`src/fork/page-translation`                                                     | HTML 文本与属性分离；占位符完整恢复；MT/LLM、术语、缓存、合批、单条降级和重试身份不漂移。                                         |
| P09/P10/P11/P14     | `src/entrypoints/selection.content`、`src/components/ui/selection-popover`、`src/utils/select-all.ts`、`src/utils/shadow-root.ts`、host toast、`src/fork/ui/selection-content`、`src/fork/ui/side-content`   | fork 实际挂载入口和 Provider/context/hook 一致；不只改休眠上游 App；页面选区、可编辑控件、iframe、host 生命周期和输入上下文隐私。 |
| P08/P12/P15         | `src/entrypoints/subtitles.content`、`src/entrypoints/interceptor.content/inject-player-api.ts`、`src/utils/subtitles/fetchers/youtube`、`src/fork/upstream-services/subtitles.ts`                           | 现有 YouTube/Shorts，listener 唯一性和释放、有效字幕获取、失败状态；不触发新平台或转录。                                          |
| P02/P04/P05/P06     | `src/entrypoints/options` 对应消费者、`src/fork/ui/options`、`src/components/ui/base-ui/color-picker.tsx`、现有字幕样式设置                                                                                  | 深链和链接语义适配现有路由；旧 picker 修复编辑/回写/拖拽，不带入重写；P05 仅补缺失可访问名称，不改外观。                          |

实施前补齐精确消费者与符号清单，编辑每个函数前执行 GitNexus impact。现图落后 166 个提交，必须先更新；HIGH/CRITICAL 告知用户后处理，UNKNOWN 用源码调用补证，不按零调用删除。提交前完整 detect-changes，partial/truncated 不算通过。

### D3：最小依赖回迁与产品隔离

P01→P03→P16、P18→P19 以及选区/host/toast 共享路径按真实依赖顺序处理。其他依赖以官方父提交差异为准，不由编号猜测。新增站点规则字段走现有 schema/解析器/合并语义，不建立第二套配置，也不自动引入持久配置版本升级。

颜色选择器只提取 Escape、回写标记消耗、色相同步和异常拖拽收尾逻辑。纯视觉贡献不移植。Toast 保持 fork 自有 Provider 与消费者组合，复用现有消息通道去重，不另建事件总线。

隐私继续要求显示工具栏不读取完整 input value；显式动作才捕获当前允许控件，敏感类型排除。术语有效集合/revision、缓存身份、MT/LLM 分流和现有队列策略保持一致。上游账号/云服务继续在入口、初始化、后台任务、请求出口隔离；不借修复打开旧配置中被禁用的入口。

### D4：来源账本与增量门禁

沿用 `src/fork/identity/selective-upstream-patches.json`：每个实际贡献使用完整 40 位 SHA，一个文件累计全部来源及 LF 归一化最终指纹。已有等价但本轮未贡献代码的来源不机械登记。部分移植记录贡献范围；fork 适配和测试也须对账，不扩大通用 allowlist。重定向清单按贡献核实后更新实际需要的指纹。

不使用 `feat/upstream-sync-*` 命名，因为 CI 会将该模式的 upstream/main 钉在 v1.51.0，无法验真本轮新增来源。现有非完整同步路径获取官方 main，并使用 `FORK_DIFF_BASE` 指向实际目标分支；本地设置同等基准。保持 CI、`FORK_SYNC_BASE`、`lastSyncedSha/version` 不变。未获授权不提交、推送、发布或归档。

### D5：验证与证据

在 `evidence/validation.md` 记录候选代码 SHA、命令、通过/失败/跳过、浏览器/包及 hash；本提案不预填通过结果。逐候选新增最小行为回归，先验证旧行为失败，再适配并验证通过；纯视觉不变且无需改动项用现有等价证据，不写镜像实现的测试。

PowerShell 中先执行 `$env:SKIP_FREE_API='true'`。全量命令：`pnpm run test`、`pnpm run test --config vitest.fork.config.ts`、`pnpm run type-check`、`pnpm run fmt:check`、`node scripts/check-fork-brand.mjs`，以及设置实际 `FORK_DIFF_BASE` 后 `node scripts/check-fork-boundary.mjs`。要求退出码 0；free-api.test.ts 明确记录为有意跳过。

构建按现有 `.github/workflows/fork-guard.yml` 的国内三浏览器和海外已声明组合执行，不自行增加发行矩阵；调用既有产物断言，不能只记编译成功。修改时针对相关文件运行小范围测试，最终运行一次完整门禁，除非新修改或失败需要复测，不无意义重复。

真实构建包验证 arXiv、GitHub issue、Telegram display:contents、CSS 菜单、GameFAQs/长文本、Google 标点换行、ruby 选区、卡片关闭/全选、简悦、Toast、YouTube/Shorts 和颜色编辑。覆盖页面翻译开关/取消/恢复、导航/卸载，并对照自有登录/网关/术语/输入链路与零上游商业请求。单元测试不能替代真实浏览器结论。登录、配额、外部平台或工具条件不足明确待验收，不记为通过；不推进发布就绪状态。

## 数据模型与接口契约

不新增业务 API、数据库或配置迁移。站点规则及请求保护参数如需扩展，使用现有可选字段，缺省保持原行为，接线贯穿实际 fork 路径，不改变收费路由和缓存语义。来源结果保存在本变更清单，运行时代码不读取规划材料。实际用户修复附 `@read-frog/extension` changeset，正文采用 `fix(...): ...`，不把上游版本发布提交一并引入。

## Risks / Trade-offs

风险包括源提交依赖后续组件重构、共享文件冲突、只修上游而遗漏 fork、懒加载一次性翻译大量隐藏内容、观察器泄漏和 HTML 占位符污染。通过依赖对账、真实消费者回归、边界与浏览器验收控制。未知依赖可令候选延期，但必须保留失败证据及用户可见影响；不能把19条“已审查”写成19条“已修复”。

回退按来源贡献撤销：共享文件重建剩余补丁结果并重验，再同步账本/指纹；不对业务分支硬重置，不误删其他来源。配置 schema/依赖不变，仍先保留现有配置和必要术语备份；若发现必须迁移，作为范围变化重新决策。Windows 本地稀疏检出排除的历史含冒号证据目录不属于本轮修改；新增证据路径使用 Windows 可用名称。

## Open Questions

无未决产品或架构问题。各候选最终等价/依赖判断、实际影响图、外站登录/服务条件属于实施待验证事实；不能预先填写通过。前轮 9.2、9.3、10.5 保持原待验收状态。

提案核验发现本机 `pnpm exec` 启动器指向不存在的 pnpm 路径；本轮通过现有 `node node_modules/oxfmt/bin/oxfmt` 完成文档格式核验。实施前须恢复仓库声明的 pnpm 12.10.1 工具链可用性，不通过改 packageManager、升级依赖或跳过工程门禁掩盖环境问题。
