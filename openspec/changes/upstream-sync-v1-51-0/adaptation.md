# B：fork适配与贡献对账

候选目标55bcef1e；已接纳基线保持1.46.6。不得为通过守卫提前推进。

- 46重定向，23对应源文件在目标发生变化，0删除；另有selection App shim等账外副本。逐项核对后更新指纹。
- 12选择性来源/113文件均已进入目标历史；13指纹漂移包括9语言包、translation-node-preset.css、translate.integration.test、traversal.ts、translation-insertion.ts。清账前核对后续业务贡献，不盲目刷新。
- 保留本仓品牌UI、会员/配额/网关/渠道、TG/Discord输入增强、动作/词典、批量策略和交互队列隔离。
- 源冲突、公共Provider、schema100→111、商业四层准入、术语快照和队列接线已实施；本地完整merge候选为`5ac5122a6a4d390b3131f917dd09aa2caf5f5342`，接纳与发布状态见validation.md。
- 实际53个冲突文件已解决。merge的第二父提交是固定目标55bcef1e；未纳入1308e8d1。

## 已保留的后续fork贡献

- 13漂移：9locale仅inputTranslationBar.triggerHint（三空格提示，65f20984/9b0bdc12）；css/insertion/integration为c75ceaf6段落布局；traversal为4be99菜单多块边界。
- c75保留标题/正文换行、菜单/导航行内、站点规则优先、pre-wrap/max-width；4be显隐事件Set与目标祖先WeakSet/ShadowDOM恢复并存。
- 公式持久缓存审计已迁background/page-translation.ts，继续复用；内容内存缓存保留canCacheInlineAtomTranslation。
- DeepLX能力probe在目标已迁core/translation-request.ts，含端点key、并发协调、降级；不重复保留旧实现，相关行为测试通过。
- 单一setupPageTranslationHandlers可选factory注入，自有批量继续生效，input/summary交互隔离；术语terms/revision贯通合批、prompt、缓存和fallback。
- package接纳引擎1.51.0、目标依赖/Node/pnpm；fork独立manifest版本、Firefox ID、渠道及品牌钩子保留，Firefox最低140。

12补丁目标均包含原源码效果，官方release已消费12份原样上游changeset，本轮跟随目标删除这些已消费文件，历史仍保留；本仓自己的changeset继续保留，并增加本轮功能changeset。

## 对账结果和独立复审

- 58个重定向：原46项中23项源未变、23项逐项适配，新增12个产品准入薄包装。源码指纹登记在贡献审核之后；详见evidence/source-review/redirect-review.json。
- 12来源、113文件例外已清账。残余业务贡献仅加入有理由的必要接缝，未把113文件整体迁入永久白名单；详见selective-contributions.json及boundary-exceptions.json。
- 术语批量键包含revision和canonical实际词条集合。相同集合反序仍可合批，不同集合拆批，防止无约束结果污染另一术语状态的缓存。该必要取舍已同步到design/spec；未改并发或批量默认参数。
- 独立review发现的术语混批缓存、ShadowRoot敏感标签、顶层/frame双规则三项P2均已修复并复审关闭；实际fork套件894项通过。
- 保留词典与用户自定义动作；新增内置动作、X/Netflix字幕、学习侧栏、专属云转录/笔记/Drive继续关闭。正常字幕、用户合格provider和自有会员路径继续存在。浏览器正向provider为本地身份stub，不能代替真实自有账号/网关验收。

## 实站补充：主题与组件契约遗漏

- 自定义动作页：上游 `EntityEditorLayout` 新增命名容器，保留的深层主题选择器把整行限制为208px；限定修复 `src/fork/ui/options/custom-actions-theme.css`，保留上游自适应结构。用户已确认实际布局恢复。
- Switch：共享 `src/components/ui/base-ui/switch.tsx` 仍消费已移除的 accent-blue utilities，同时没有输出 `src/fork/ui/options/options-theme.css` 依赖的四个 Motion CSS变量。恢复固定上游的有效 accent/ring 类，补回同一动画值出口，options明确主色／反色。事件处理、状态源、尺寸和拖拽决策不变。两处生产文件与独立审查、真实组件证据见 `evidence/switch-theme-fix/`。这是完整merge后的语义适配遗漏，不能以 Git 文本冲突清零推定 UI 全通过。

- 选择工具栏设置页：上游 `ActionsSection` 新增的 `NoteSuggestionItems` 在渲染时无条件调用 `resolveNoteSuggestionAction`，fork准入解析器按约定拒绝，导致设置整页恢复模式。新增这一个未准入叶子的空组件重定向，保留翻译／朗读和显示设置、拒绝出口及旧配置。注册表由58增至59，仅登记已逐行审核的新增源文件指纹 `8d2e9b2e21b01185`，未刷新既有条目；回归直接渲染真实fork页面，补足此前仅测右键菜单示意区的覆盖缺口。详见 `evidence/selection-toolbar-settings-fix/`。

## 三项实站UI回归的统一归因

自定义AI指令窄列、Switch开启状态、选择工具栏设置页异常，均已确认是本次合并后本仓适配遗漏造成的集成回归。对应遗漏分别为DOM结构与旧CSS、主题token／Motion变量生产消费契约、未准入组件的渲染挂载。三项均已修复并获用户实际页面确认。此前设置页覆盖不足已通过布局、状态与真实Page集成回归补充；不能从单元／构建通过推定全部真实设置页已验收。H01保留原有逻辑归因，H02仍未定位，不并入三项结论。

## 合并后统一回归补充

统一检查进一步确认并修复6项遗漏：outline-accent组合按钮文字、warning前景、宽Layout Dialog、xs分段按钮、嵌套结果ShadowRoot选区、popup词典provider摘要。前四项限定fork options主题；上游layout-field.tsx仅新增实例标记；后两项分别对齐固定55bcef的host遍历和既有获准动作枚举。未改公共Button、resolver/transport或产品准入。

新增上游例外仅layout-field.tsx精确路径，用于fork主题定位宽编辑器；4份修复changeset为发布说明登记，无目录放行。固定SHA守卫之外补查dirty/untracked边界，原guard未改。未刷新旧指纹，不推进1.46.6已接纳基线。MoreMenu/pin及Hub朗读保持功能差异，未冒充上游完全对等。完整矩阵、RED/GREEN、图盲点及产物见[evidence/merge-regression-sweep/README.md](evidence/merge-regression-sweep/README.md)。

## 原翻译降本复核与空术语缓存修复

原0906降本实现的9份核心文件与合并前4be逐字节相同，源码及生产background AST均确认实际注入fork工厂；16/4000合批、MT100项及编码预算、页面真实在途4和输入隔离保留。受控真实SDK HTTP验证默认16段合1次、缓存重复不新增请求，Google/Microsoft101段各拆100+1。不同有效术语集合仍严格拆批，同revision的1/2/16组对应1/2/16次请求，这是保留的正确性取舍。

本轮发现5ac适配给空有效术语集合也追加revision，导致无术语等价缓存额外失效。最小修复仅在非空有效集合追加内容缓存revision，保留后台盐、严格分组及删除后的旧约束隔离；先完成HIGH影响提示、架构复审和规格修订，再完成3FAIL/2PASS到5PASS及独立反向验证。translate-text.ts既有redirect源指纹仅单项更新为7127f4edfbd63b03，精确登记新增changeset，无新缓存层或迁移。完整证据见[evidence/cost-reduction-preservation/README.md](evidence/cost-reduction-preservation/README.md)。真实删除生命周期F02、实际账单和原降本发布门仍未关闭。
