# B：fork适配与贡献对账

候选目标55bcef1e；已接纳基线保持1.46.6。不得为通过守卫提前推进。

- 46重定向，23对应源文件在目标发生变化，0删除；另有selection App shim等账外副本。逐项核对后更新指纹。
- 12选择性来源/113文件均已进入目标历史；13指纹漂移包括9语言包、translation-node-preset.css、translate.integration.test、traversal.ts、translation-insertion.ts。清账前核对后续业务贡献，不盲目刷新。
- 保留本仓品牌UI、会员/配额/网关/渠道、TG/Discord输入增强、动作/词典、批量策略和交互队列隔离。
- 源冲突、公共Provider、schema100→111、商业四层准入、术语快照和队列接线：实施中，尚未验收。

后续适配证据在此补充。

## 已保留的后续fork贡献

- 13漂移：9locale仅inputTranslationBar.triggerHint（三空格提示，65f20984/9b0bdc12）；css/insertion/integration为c75ceaf6段落布局；traversal为4be99菜单多块边界。
- c75保留标题/正文换行、菜单/导航行内、站点规则优先、pre-wrap/max-width；4be显隐事件Set与目标祖先WeakSet/ShadowDOM恢复并存。
- 公式持久缓存审计已迁background/page-translation.ts，继续复用；内容内存缓存保留canCacheInlineAtomTranslation。
- DeepLX能力probe在目标已迁core/translation-request.ts，含端点key、并发协调、降级；不重复保留旧实现，相关行为测试通过。
- 单一setupPageTranslationHandlers可选factory注入，自有批量继续生效，input/summary交互隔离；术语terms/revision贯通合批、prompt、缓存和fallback。
- package接纳引擎1.51.0、目标依赖/Node/pnpm；fork独立manifest版本、Firefox ID、渠道及品牌钩子保留，Firefox最低140。

12补丁目标均包含原源码效果，官方release已消费12份changeset。本仓原changeset按历史保留；待适配回归完成后清选择性账本。
