# 页面翻译降本历史保留审计

检查基准：业务 `4be99b341a7c940a48794232f066db43339cc2d2` → 当前 `e1d90dc928ca5fbbbba112e480131e1c909c93ce`（已有UI dirty保留），固定上游v1.51.0/`55bcef1e`。仅源码/文档/历史读取；未测试、构建、浏览器或读取私人配置。

**结论：未发现原降本核心被上游覆盖，且实际后台仍注入fork队列工厂；但新增术语适配有拆批与冷缓存成本，不能声称请求数或旧LLM缓存命中完全不变。** 以下“保留”仅是源码证据，不代表本轮运行通过。

## 历史定位

- `3590d73e`：原降本方案/验收记录；原需求业务基线8da720d0。
- `0906e79135a91da534dcc6ae504f72342d510128`：降本实现，包含fork叶子、真实并发和Google/MS原始批量入口。
- `433b148dbd73ed7e8fbfcf20c88035089364200e`：后续翻译/公式贡献，已进入4be。
- `5ac5122a6a4d390b3131f917dd09aa2caf5f5342`：合并55b并重接后台拆分、术语快照。
- 当前检查9个关键文件与4be及原0906 **字节相同**：policy、wire、mt、migration、RequestQueue、BatchQueue、Google/MS API、background/config。fork的llm/queues/types相对4be仅增4/7/3行术语字段/传递。各文件SHA256及对比结果见JSON。

## 原机制 → 当前实际路径

| 机制 / 原要求                            | 当前证据（仓库相对路径:行）                                                                                                      | 源码结论                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM候选16项/4000字符；只迁移精确4/1000   | `src/fork/page-translation/policy.ts:4–16`；`migration.ts:6–20`；`src/entrypoints/background/config.ts:10–28`                    | 原0906完整保留。独立迁移key；先config后标记；共享Promise失败清空后可重试；自定义4/2000等及字幕不覆盖。上游DEFAULT_BATCH_CONFIG仍4/1000（constants/translate.ts:9–15），正常新装/旧精确默认由fork初始化改16/4000。存储初始化失败走DEFAULT_CONFIG时可能回4/1000，非本次新增。 |
| 页面LLM/MT两Batch共享真实在途4；输入独立 | `queues.ts:56–69,195–205`；`src/utils/request/request-queue.ts:202–221,315–332,412–414`                                          | page maxConcurrent4；interaction无该硬上限，仍有独立rate/capacity。超时/取消只发abort，真实调用settle后才释放槽；先完成错误分类。RequestQueue与4be/0906一致。                                                                                                               |
| MT100项/编码后32KiB及provider限制        | `queues.ts:200–205,213–220`；`mt.ts:14–53`；Google API:125–165；MS API:37–47,71–97                                               | 100项，阈值32768−512字节；按实际escape/JSON UTF8计量。Google逐项保存换行；MS明确拒绝HTML；其他provider不被误套MT批量。超大单项不拆正文，单项一批；32KiB不是强制拒绝单条的硬上限（BatchQueue:288–323）。                                                                     |
| 默认LLM v1紧凑协议；自定义兼容           | `llm.ts:25–62,124–150`；`wire.ts:105–150`                                                                                        | 仅默认promptId且HTML无原生id冲突时flat JSON t0…；其他内置/自定义仍原prompt与%%分隔。协议无新增version字段；保留原v1含义。默认HTML data-rf-attr压为id；冲突段退兼容桶。                                                                                                      |
| provider/prompt/context完整快照和key     | `queues.ts:34–53,83–87,207–210`；`page-translation.ts:137–166`；`llm.ts:71–99`                                                   | 入队structuredClone冻结；key保留完整provider/prompt/language/context/format/lines/scope/feature/structured，调用getLanguageModelForConfig快照，不改为按id现读。reasoning、temperature、providerOptions保留；任译喵只临时加json_object，不走native schema；SDK重试0。        |
| 逐项协议失败只降级一次；网络独立预算     | `queues.ts:133–194`；`llm.ts:102–120`                                                                                            | 原0906保留：BatchQueue重试0/自动fallback=false；网络RequestQueue maxRetries2、base1000ms；协议解析在await网络后，成功项不重发，仅失败项single一次；认证/取消不误走协议fallback；只有明确400 response_format unsupported走旧单条。                                           |
| marker完整性 / sentinel                  | `wire.ts:30–116`；`llm.ts:140–149`；`src/utils/host/translate/html-attribute-markers.ts:276–309`                                 | ASCII扫描保偏移、注释/raw-text保护、自闭合分隔；未知/重复/缺失/错tag均失败。sentinel跳过不存在marker还原，保持canonical再缓存/回填。MT normalize一次（mt.ts:68–76）。                                                                                                       |
| 后台同步注册，工厂不能失接               | `src/entrypoints/background/index.ts:5,139` → `page-translation.ts:63–66` → `translation-queues.ts:477–517`                      | 上游06e3c743拆分旧setUpWebPageTranslationQueue后，本轮5ac重接setupPageTranslationHandlers(createPageTranslationQueues)；kind=fork仍走factory。图context工厂incoming为空是动态factory盲区，不表示未使用。                                                                    |
| 配置热更新、输入与摘要隔离               | `translation-queues.ts:440–469`；`page-translation.ts:144–182,248–276`；`src/utils/host/translate/translate-variants.ts:256–277` | watch同步page/interaction rate/capacity及LLM batch；inputTranslation路由走interaction，输入前置summary同样绕过页面饱和。fork实际input hook调用translateTextForInput（use-input-translation.ts:474）。字幕独立工厂:528–540，不套page cap4。                                  |
| scope取消、迟响应/失败不缓存             | `queues.ts:70–72,141–179,221–223,228–233`；`page-translation.ts:128–134,213–243,279–311`                                         | scope=tab:session；batch/dedup/downstream hash含scope；先mark再await，先drain batch再request；本轮补interaction cancel/tab-close drain。请求后再次live，错误reject不会走缓存写入。普通input未带sessionId，不应声称所有input均可取消。                                       |
| 缓存复用与公式保护                       | `page-translation.ts:39–59,116–125,213–243`；`translate-text.ts:395–455`；`inline-atom-tokens.ts:3–8`                            | 持久缓存不按scope隔离，canonical/sentinel仍共享；无效marker缓存删除，失败不存。公式token丢失/重复/未知不进DB；本轮也保留4be的内存缓存保护。forceRetranslation仍绕过读取，成功才替换。**LLM缓存identity新增变化见下节。**                                                    |

## 必须披露的成本变化与未证项

1. **同术语版本也可能拆批（本轮5ac适配）。** `queues.ts:46–51`把有效术语列表加入batch/dedup key；同页不同段命中不同term集合不再合批。它保证prompt/缓存与每项快照一致，但可能降低批量利用率。对照上游共享路径 `translation-queues.ts:130–205` 是同revision下union；fork当前不是该策略。不能把上游注释“术语列表不入key”套到实际fork路径。需本轮测试记录命中集合相同/不同的请求数；真实收益另测。

2. **默认空术语表也会让旧LLM缓存变冷（本轮5ac适配，非55b原件）。** 当前 `translate-text.ts:382–389`在glossaryEnabled且LLM时无条件追加revision标签。55b此段没有该追加；4be也没有。glossary默认true（`constants/glossary.ts:13–17`），升级v100→101缺字段亦设true（`config/migration-scripts/v100-to-v101.ts:73–74`），页面确实传开关（translate-variants.ts:141）。故空表revision0也改变历史LLM hash；后续不相关术语编辑也可能令未命中段缓存失效。MT不加此标签。此为保守正确性/缓存隔离成本，必要性应单列确认，不能归为“旧缓存全量保留”。

3. **摘要取消不是已证明的scope保障。** 原4be的getOrGenerateSummary也以requestQueue.enqueue(thunk, Date.now(), cacheKey)无scope；当前提取的translation-context-summary.ts:65–76仍无scope且直接缓存summary。此次没有据此证明回退；但段落的cancel/不缓存结论不能扩写为“取消后任何前置摘要都不写缓存”。

4. 原16/4000、MT100、并发4始终标作development candidates（policy.ts:3），原tasks.md:25–28的5.1–5.4仍未勾选。validation.md:5–9,55–60明确：历史三页Google51次，≤30未达；旧token比例小样本不等于全场景。源码保留不证明本轮节省≥50%、MT降≥90%、交互不退化或默认值正式验收。

## 本轮验证边界 / 最小后续

- GitNexus status：indexed/current均e1d90dc，up-to-date。query定位SetupPageTranslationHandlers；context确认main→setupPageTranslationHandlers，而factory被高阶参数调用未建caller边；已源码补证，未将0caller判无影响。
- 已做git show/diff、9文件字节等价、三fork文件增量核对。已读当前定向测试定义：queues、llm、wire、mt、migration、request-concurrency、background、glossary；**未运行，不引用历史pass作本轮通过**。
- 另一测试代理应覆盖现存16/4000、100/载荷、timeout/cancel迟settle、部分失败、HTML sentinel、双tab与input饱和隔离；再记录术语不同集合的实际批数、空表升级/不相关revision的cache行为。此审计不擅自调整方案或代码。
- 仅写history-audit.md/json。现有生产、测试、UI dirty均保留。

## 主代理收尾处置（保留以上修复前审计快照）

上述第2项空有效词条revision额外失效已完成最小修复：内容端追加条件glossaryTerms.length > 0，非空revision、后台盐和严格分组保留。真实核心5项GREEN，独立恢复旧条件为3FAIL/2PASS，未关闭真实删除生命周期F02。第1项术语拆批已经真实SDK HTTP量化，同revision的1/2/16个集合各为1/2/16次；严格隔离保持。最终主4998/fork997通过，新包已更新但尚待重载；真实tokens/账单未测。本文前文的“当前”与“未运行”属于初始只读审计时点，最终状态以[README.md](README.md)和[result.json](result.json)为准，原始审计不追改为修复后结论。
