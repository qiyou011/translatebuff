# 历史 partial 影响分析复查

- 仓库/图绑定：`/Users/yisen/.codex/worktrees/upstream-sync-v1-51-0/translatebuff`；HEAD `5ac5122a6a4d390b3131f917dd09aa2caf5f5342`；业务基线 `4be99b341a7c940a48794232f066db43339cc2d2`。图为19763节点，indexedAt `2026-10-15T04:32:49.467Z`、lastCommit `6a6f007660905972861000b7cf1352c3b2fa01ab`。注册表因merge历史显示142 commits behind；不可称提交元数据已一致。本批10个源文件SHA256均匹配图fileHashes，复查结束时内容未变；不据此推断图中所有调用文件均新鲜。
- 输入实际为25个符号、10个唯一文件。历史33项中的另8项由父任务认定文件未变，不在本输入中，本次未独立重跑这8项。
- 完整raw见同目录 `impact-followup.json`：每项均保存原历史结果、本次maxDepth=3结果和必要的maxDepth=1结果；未截断结果数组。调用均为upstream、minConfidence=0、includeTests=false，使用确切target_uid及绝对repo路径。

## 结果与限制

本批25次d3调用均未完整：24项partial、1项旧cn UID不存在；partial诊断为 `impact:depth-traversal / Write operations are not allowed. The pool adapter is read-only.`；本任务没有请求图写入，impact生成的读取被适配器守卫拒绝。降至d1后20项无partial/truncated/error，仅证明直接依赖层遍历完成，不能写成完整d3遍历通过。另5项仍为UNKNOWN：4项d1仍partial，1项旧cn UID不存在。对4项名称查询补回1/4/3/5条直接边；这些只读Cypher原始结果也已保存，但不是impact遍历成功，故未改写UNKNOWN结论。

零调用/零流程不能解释为未使用。图风险保留CRITICAL/HIGH：Button d1=129、流程=33，为CRITICAL；AlertDialog系列多项HIGH。graph process还包含上游Drive等静态休眠路径，需结合redirect-review和实际执行边界理解，不能据图判定商业功能已开放或已隔离。

| 符号                            | d1直接符号 | 图流程数 | 解释风险 | 遍历范围         | 调用者示例/补充                                         |
| ------------------------------- | ---------: | -------: | -------- | ---------------- | ------------------------------------------------------- |
| needsApiKeyWarning              |          0 |        0 | UNKNOWN  | impact仍不完整   | 名称查询补充1边                                         |
| SetApiKeyWarning                |          0 |        0 | UNKNOWN  | impact仍不完整   | 名称查询补充4边                                         |
| AlertDialog                     |         16 |        4 | HIGH     | 完整d1，非完整d3 | AutosaveNavigation / DeletePrompt                       |
| AlertDialogTrigger              |          9 |        2 | MEDIUM   | 完整d1，非完整d3 | DeletePrompt / RecoveryFallback                         |
| AlertDialogPortal               |          1 |        1 | LOW      | 完整d1，非完整d3 | AlertDialogContent                                      |
| AlertDialogOverlay              |          1 |        1 | LOW      | 完整d1，非完整d3 | AlertDialogContent                                      |
| AlertDialogContent              |         16 |        4 | HIGH     | 完整d1，非完整d3 | AutosaveNavigation / DeletePrompt                       |
| AlertDialogHeader               |         16 |        4 | HIGH     | 完整d1，非完整d3 | AutosaveNavigation / DeletePrompt                       |
| AlertDialogFooter               |         16 |        4 | HIGH     | 完整d1，非完整d3 | AutosaveNavigation / DeletePrompt                       |
| AlertDialogTitle                |         16 |        4 | HIGH     | 完整d1，非完整d3 | AutosaveNavigation / DeletePrompt                       |
| AlertDialogDescription          |         16 |        4 | HIGH     | 完整d1，非完整d3 | AutosaveNavigation / DeletePrompt                       |
| AlertDialogAction               |         15 |        4 | HIGH     | 完整d1，非完整d3 | DeletePrompt / RecoveryFallback                         |
| AlertDialogCancel               |         15 |        4 | HIGH     | 完整d1，非完整d3 | DeletePrompt / RecoveryFallback                         |
| Button                          |        129 |       33 | CRITICAL | 完整d1，非完整d3 | DownloadSourceSubtitles / DownloadTranslatedSubtitles   |
| useSelectionPopoverOverlayProps |          4 |        0 | LOW      | 完整d1，非完整d3 | ContextDetailsButton / SelectionToolbarFooterContent    |
| isAPIProvider                   |          2 |        3 | HIGH     | 完整d1，非完整d3 | useRequestedProvider / isAPIProviderConfig              |
| isPureAPIProvider               |          3 |        0 | LOW      | 完整d1，非完整d3 | needsApiKeyWarning / isPureAPIProviderConfig            |
| buildProviderConfigRouteFrom    |          2 |        0 | LOW      | 完整d1，非完整d3 | buildProviderConfigRoute / buildProviderTypeConfigRoute |
| buildProviderConfigRoute        |          1 |        0 | LOW      | 完整d1，非完整d3 | SetApiKeyWarning                                        |
| openOptionsPage                 |          3 |        1 | HIGH     | 完整d1，非完整d3 | SetApiKeyWarning / main                                 |
| cn                              |     未解析 |   未解析 | UNKNOWN  | impact仍不完整   | 见源码补充                                              |
| TooltipProvider                 |          8 |        0 | MEDIUM   | 完整d1，非完整d3 | onMount / SubtitlesProviders                            |
| createCustomPromptsConfigSchema |          2 |        0 | LOW      | 完整d1，非完整d3 | subtitles.ts / translate.ts                             |
| createReactShadowHost           |          0 |        0 | UNKNOWN  | impact仍不完整   | 名称查询补充3边                                         |
| removeReactShadowHost           |          0 |        0 | UNKNOWN  | impact仍不完整   | 名称查询补充5边                                         |

## 源码补充

- `needsApiKeyWarning`：`set-api-key-warning.tsx:35`实际被`SetApiKeyWarning`调用；后者由fork `ui/options/feature-providers-config.tsx:36`及上游两类provider字段调用。直接名称查询分别1/4边（置信度0.85）；impact进程数仍未可靠解析，不能记零风险。
- `createReactShadowHost` / `removeReactShadowHost`：源码有页面spinner、字幕按钮/侧栏、页面清理等调用，名称查询3/5边（置信度0.85）。`create-shadow-host.tsx:52–54`把清理closure写入DOM对象属性，`:62`可选调用执行`root.unmount()/hostBuilder.cleanup()`；该动态属性链不能依赖静态零调用结论。
- `cn`：`src/utils/styles/utils.ts:1`现为`export { cn } from "cn"`，旧本地函数UID已不存在；`package.json:100`依赖外部`cn ^0.4.0`。文本复查有138个生产文件调用`cn(...)`，是外部重导出影响面，不能视作删除死代码。
- `createCustomPromptsConfigSchema`：`translate.ts:128`工厂返回Zod schema；`:166/:206`写入页面配置，`subtitles.ts:19`构造字幕配置。图d1=2、流程=0只表示命名过程未收录，不能覆盖schema消费/预处理/迁移数据流；`src/types/config/__tests__/translate-prompts.test.ts`显式测试生成的schema。

## 已有验证证据及本次边界

本次只读已有日志，未运行新测试：`/tmp/translatebuff-sync-main-final-2.log`记录477文件通过/1外部skip，4993测试通过/4外部skip；fork对应日志记录111文件/894测试通过。两份日志SHA256、时间和原摘要均保存在JSON；原日志另复制到`../engineering/`。顶层`validation.md`汇总工程、独立审查及实际浏览器证据。这些证据支持现有候选的回归结果，不能解除图遍历限制或替代真实浏览器验收，也不是本次影响复查重跑产生的结果。

结论：历史partial已有逐项复查和风险解释；本批没有完整d3成功证明，20项只有完整d1证据，5项UNKNOWN已补源码/直接图边。不可将本文件标记为“所有影响分析clean”或“零风险”。
