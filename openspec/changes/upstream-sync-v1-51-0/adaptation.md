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
