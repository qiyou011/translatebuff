# 上游翻译修复实施设计

## Goal

在 1.4.0 基线上移植已批准的 12 条修复，保留 3 条延期，并建立可核验、可撤销的文件级来源记录。

## Architecture

共享翻译与配置层复用上游修复；fork 实际入口显式适配。官方 Git 来源验证与最终文件指纹共同约束边界例外；完整同步仍使用 merge。

## Tech Stack

TypeScript、React、Jotai、WXT、Vitest、IndexedDB、Node.js 边界脚本与 GitHub Actions。

## Context

基线与完整 SHA 清单见 proposal.md、upstream-fixes.md。探索阶段三轮修订后，用户已批准文件级多来源账本与官方上游校验设计，architect_review 最终结论为「审查通过」。

当前本地只有 origin，原始 15 个来源对象尚不在本地对象库。页面翻译实际经过 src/fork/page-translation；popup 与悬浮按钮也有 fork 副本。只复制上游文件无法保证用户路径生效。原始补丁涉及 110 个不同路径，应以逐条官方 diff 而非目录覆盖作为移植边界。

## Goals / Non-Goals

- 完成清单中的 12 条修复及必要适配，保留来源、测试和撤销证据。
- 保留会员、网关、批处理、云隔离契约和提供商设置只读行为。
- 不引入术语库、视频侧栏、AI 转录入口、上游品牌服务、模型目录或依赖升级；不升版本号。其余 27 条建议不纳入本期。

## Decisions

### D1：选择性补丁与完整同步分离

不直接 cherry-pick 整组提交，也不执行完整 merge。逐条提取批准 SHA 的 diff，在当前基线适配；保留 12 个原始 changeset 并检查 conventional commit 内容。新增 fork 修复若不被这些条目覆盖，补充 @read-frog/extension changeset。

src/fork/identity/upstream-baseline.json 的 lastSyncedSha 保持 02ad422c1e1260960e141e4012a20d93e85082aa、版本保持 1.46.6。更新 FORK.md 解释本期例外及后续 merge 的账本清理。不能通过批量扩大 fork-allowlist.json 接受补丁。

### D2：文件级多来源账本与边界门禁

实施阶段新增 src/fork/identity/selective-upstream-patches.json：

```json
{
  "sources": [{ "sha": "<40 位官方 SHA>", "subject": "<提交主题>", "status": "applied" }],
  "files": [
    {
      "path": "<仓库相对路径>",
      "sha256": "<LF 归一化最终内容的 SHA256>",
      "sources": ["<40 位官方 SHA>"]
    }
  ]
}
```

这是结构示例，不得将占位值写进正式账本。sources 与 files 均去重；文件来源必须存在且有实际贡献，路径不得越出仓库。最终 hash 对累计内容计算；rules.json、prompt.ts、subtitles.ts、locale 和共享测试的多来源不能互相覆盖。上游删除的文件须在审查记录中保留来源，校验器应验证其应有的不存在状态；具体表示在实现前结合实际 diff 固定并补充 schema 测试，不能用不存在文件的伪造 hash 代替。

scripts/check-fork-boundary.mjs 先完整预检账本，再分类变更路径。依次验证结构、来源对象存在、官方 main 祖先关系、相对完整同步基线是否过期、最终内容指纹。未知或未登记漂移失败，禁止自动刷新 hash。指纹只表示经审查的最终内容，不能单独证明内容来自官方。

.github/workflows/fork-guard.yml 从固定 https://github.com/mengxi-ream/read-frog.git 获取 main 到明确官方引用；本地配置或校验同一 upstream 地址。来源必须是该引用祖先，不能信任任意同名 remote。与当前 upstreamRef/lastSyncedSha 的过期比较须使用完整同步基线，不能误用刚 fetch 的官方最新 main，否则所有合法选择性来源都会被误判过期。Git 命令退出码 0、1、执行错误分别处理，128 必须报错。任何已完整合并来源即使本次未触及其文件，也触发清理要求。

### D3：公式 token 贯穿实际批处理与双层缓存

移植 site-rules 类型与解析、DOM filter/traversal、translation-modes、translation-insertion、translation-node-preset.css，新增上游 inline-atoms.ts 与 inline-atom-tokens.ts。MathJax/KaTeX 等公式转换为 {{n}} 占位符，清理克隆并在渲染时恢复，原子节点后代不重复翻译。

src/utils/prompts/translate.ts 中保留指令必须到达 src/fork/page-translation/llm.ts 的 buildPageLlmPrompt，覆盖 JSON 批处理及旧版/单条路径。后台 src/entrypoints/background/translation-queues.ts 和 src/utils/host/translate/translate-text.ts 的标签页缓存写入共同使用准入判断：

```ts
!hasInlineAtomTokens(source) ||
  isNoTranslationSentinel(result) ||
  auditInlineAtomTokens(source, result).ok
```

源文本、译文必须按同一条目的 token 范围审计。缺失、重复、凭空新增 token 的结果均不写入任一缓存；合法 sentinel 按无需翻译处理。DOM 可补回缺失公式，不能因此把异常译文缓存。针对实际注入 fork queue factory 的调用链测试，不能只测试上游 fallback。

### D4：配置草稿与实际 fork UI

移植 src/components/form/autosave-controller.ts、autosave-navigation.tsx、use-autosave.tsx 及字段组件；更新 src/utils/atoms/config.ts 和 entity-config.ts 的函数式更新，整合 options/main.tsx 的路由与导航保存。

无效 JSON 不覆盖持久配置；组合输入 begin/end 生命周期与导航行为沿用审查后的控制器契约，并以测试明确。处理并发配置更新，避免旧快照覆盖独立字段。

src/fork/ui/options/providers-config.tsx 当前是只读入口，不引入上游编辑表单。实际自定义动作表单验证保存流程；上游 JSON 编辑器测试只证明共享组件，不能冒充 fork 提供商设置的端到端证据。

适配 src/fork/ui/popup/translation-mode-selector.tsx 的 getTranslationOnlyBlockedReason、src/fork/ui/side-content/floating-button/index.tsx 的事件命中范围，以及 src/fork/ui/selection-content/use-selection-translation-controller.ts、use-custom-action-controller.ts 的 atom 重命名消费者。逐项审查后才更新 redirect-baseline.json。

### D5：站点、字幕与提示词

- src/utils/site-rules/built-in/rules.json：累计合并 Alibaba、arXiv、公式及 Substack 规则，避免后写覆盖前写。
- src/entrypoints/background/db-cleanup.ts：七天分句缓存清理与同步 alarm 注册；不启用 AI 转录。
- YouTube 平台 config.ts、ui/use-controls-visible.ts、src/utils/constants/subtitles.ts：移植实际控制条测量与嵌入选择器。共享文件不得夹带延期直播回放逻辑。
- src/utils/constants/prompt.ts：合并保留名称判断及分句长度规则；前者无需引入术语库。真实模型质量独立验证。

## Risks / Mitigations

| 风险                                    | 应对                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 共享文件多个来源覆盖                    | 单路径累计 hash、多来源登记、逐条 diff 审查                                                      |
| atom/配置动态消费者未被图索引解析       | impact UNKNOWN 后核对文本与实际入口，补真实调用测试                                              |
| 公式异常污染另一层缓存                  | 共用准入函数，逐层断言写入次数及重试行为                                                         |
| CI 没有来源对象或信任错误 remote        | 固定官方 URL fetch，显式引用，Git 错误关闭门禁                                                   |
| 未提交变更未被边界默认 base...HEAD 覆盖 | 校验时记录实际检查范围，使用支持工作区的模式或在提交后检查真实提交范围，不宣称默认命令覆盖工作区 |
| 自动保存迁移导致丢稿                    | 先复现 IME、无效 JSON、导航和并发场景，再适配                                                    |
| 模型输出非确定性                        | 单测验证契约，真实网关单独记录输入与结果，不虚构效果指标                                         |

## 验证策略

实施前对每个修改符号执行 GitNexus impact，HIGH/CRITICAL 先报告；UNKNOWN 补核对。提交前 detect-changes 必须完整且无截断。

PowerShell 先设置 SKIP_FREE_API=true；先运行各修复定向 Vitest，再 root 测试及 pnpm run test --config vitest.fork.config.ts src/fork。执行 type-check、fmt:check、Chrome/Edge/Firefox 构建及品牌、边界、产物与域名隔离检查。具体脚本参数以 package.json 和脚本帮助为准，记录命令、范围、结果。

真实 Chrome 验证触摸轮播、悬浮控件命中、公式翻译恢复、YouTube 迷你播放器、设置组合输入与导航；实际网关验证 sentinel 和分句样例。无法执行的场景明确列为未验证，不能用单测代替。

## 回滚方案

为每个来源保持可审查补丁边界；允许提交时采用独立提交，未获提交授权时保留等效补丁记录。fork、缓存和门禁适配按依赖成组撤销。共享文件先重建剩余补丁累计内容、验证并更新 hash/贡献关系，再移除来源；不 reset 用户分支或直接删账本行。旧分句缓存删除不可恢复，但可重新生成。完整 merge 后删除已吸收的来源及冗余文件例外，不能靠提前推进基线消除过期错误。

## Open Questions

无待用户决策的范围问题。实施时需以真实 diff 核实删除文件表示、脚本测试入口及环境可用性，并在完成记录中写出结果；不能改变已批准的 12/3 范围或来源验证原则。
