# A：固定来源审查

业务起点：`4be99b341a7c940a48794232f066db43339cc2d2`。已接纳完整基线仍为`02ad422c1e1260960e141e4012a20d93e85082aa` / 1.46.6。
候选目标：正式`v1.51.0` / `55bcef1e684fb4e70f4dce3063e7bd3066f46891`；不包含后续`1308e8d1`。

架构审查结论：审查通过。重点门禁：完整value延后至显式动作；术语revision贯通；固定CI；先贡献对账后指纹；升级失败先恢复旧配置；真实三上下文网络验收。

## 产品15项来源

| 事项                | 来源     |
| ------------------- | -------- |
| GitHub脚注          | 625bb2d8 |
| 长页上下文          | 49f0db1c |
| 动态包裹去重        | f672b31d |
| React19相同重写     | eab2f3ca |
| 输入动作上下文      | 3f8a2acf |
| Google引用卡        | 6e7225d7 |
| Wikipedia短文本     | 308a08d7 |
| Kaggle Learn        | 50842cf2 |
| YouTube自动字幕时长 | b81a4b96 |
| LaTeXML行内代码     | 26515768 |
| 同源iframe懒激活    | 766b7d33 |
| 标题开关            | 598432ef |
| YouTube拖拽菜单     | f347fa5f |
| Reddit输入翻译      | 0bfc7acd |
| body替换            | f1cde34a |

以上来源均为固定目标祖先；实现和验收边界见design与规格。

## 合并前图影响

已在隔离工作树更新索引至业务起点，并查询受上游变动文件及fork符号。详细本机原始结果`/tmp/translatebuff-upstream-all-impact.json`，2582符号：{"LOW": 2174, "CRITICAL": 132, "HIGH": 231, "MEDIUM": 45}。其中33项partial，不能视为通过。已向用户报告HIGH/CRITICAL。

公开启动链包括PageTranslationManager→bootstrapHostContent、readSelectionSnapshot→fork handleMouseUp、setupFork→background main。队列工厂动态注入未被图完整追踪；源码确认background/index导入createPageTranslationQueues并传入setUpWebPageTranslationQueue，不能按零调用删除。部分UID触发GitNexus只读守卫误报，需按实际改动补查；提交前另行完整detect_changes。

## 完整merge及复核

本地候选`5ac5122a6a4d390b3131f917dd09aa2caf5f5342`保留双父合并：发布隔离/立项提交`6a6f007660905972861000b7cf1352c3b2fa01ab`及固定正式目标`55bcef1e684fb4e70f4dce3063e7bd3066f46891`。实际53个冲突文件已按贡献解决。

提交前重建图并完整执行detect_changes(scope=all)：3671受触及符号、214受影响流程、804变动文件，CRITICAL；无error/partial/truncated。raw见evidence/source-review/graph-detect.json。该结果代表本轮改动范围广，不能表述为零风险。历史33项partial的补查与源码边界说明单列于impact-followup证据，不用完整detect结果替代影响分析。
