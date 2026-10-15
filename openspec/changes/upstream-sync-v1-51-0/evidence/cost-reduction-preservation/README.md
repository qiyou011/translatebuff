# 原翻译降本保留性复核

2026-10-15：原页面翻译降本核心仍被实际后台使用，未被上游默认队列覆盖。9个关键实现文件与原降本提交及合并前业务基线逐字节相同。本轮受控HTTP量化确认原合批、协议、缓存及调度保护有效；另发现并修复本轮术语适配造成的空匹配缓存额外失效。

这里确认机制保留及受控请求数，不证明所有页面的实际token、账单或性能收益不变。不同有效术语集合的严格拆批仍保留，相关成本取舍见下。

## 基线、实际接线与来源

- 原实现：`0906e79135a91da534dcc6ae504f72342d510128`；业务基线：`4be99b341a7c940a48794232f066db43339cc2d2`。
- 固定上游：`v1.51.0 / 55bcef1e684fb4e70f4dce3063e7bd3066f46891`；工作树HEAD：`e1d90dc928ca5fbbbba112e480131e1c909c93ce`，本轮修复未提交。
- 当前 `background/index.ts:139` 仍调用 `setupPageTranslationHandlers(createPageTranslationQueues)`，经过队列loader的factory分支进入本仓实现。源文件“还存在”不是本轮唯一依据。
- [历史逐项对账](history-audit.md)及JSON记录9份关键文件（policy/wire/mt/migration、RequestQueue/BatchQueue、Google/MS transport、background/config）与4be及原实现一致；fork llm/queues/types的同步变化主要是术语透传与有效快照分组。
- [编译后AST检查](built-wiring-final.json)从真实生产`background.js`验证main传入实际fork factory、loader使用该参数、独立交互队列、页面并发4及16/4000默认对。不是仅搜索常量。修复前后后台文件SHA256均为`0ea1e86b3258d2bf10f7459bde506b4b0b50d2114522d26b46fb741581c57d6e`；本轮生产变化只在内容缓存条件。

图索引HEAD与当前HEAD一致。高阶factory和构建redirect是图盲点，已由源调用链、编译AST及真实handler测试补证；工厂0caller不当作无影响。

## 本轮可计数的验证

LLM链路保留真实后台handler、fork BatchQueue/RequestQueue、prompt/wire、provider factory和AI SDK，仅网关fetch、消息注册及存储边界受控。实际序列化的HTTP请求体被捕获，未保存headers或API key。MT保留真实handler/queue与Google/MS transport编解码，fetch返回受控响应。缓存测试使用Map实现DB接口，不冒充真实浏览器IndexedDB。

| 场景                                        | 实测结果                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 默认兼容模板，16个短HTML段，明确16/4000配置 | **1次HTTP**，16条结果正确对应，后续同缓存身份请求不增加HTTP                                                             |
| 同revision、同一有效术语集合16项            | **1次HTTP**                                                                                                             |
| 同revision、2个有效术语集合16项             | **2次HTTP**，各8项                                                                                                      |
| 同revision、16个有效术语集合16项            | **16次HTTP**，每组1项；严格隔离保留                                                                                     |
| 自定义模板16项                              | **1次HTTP**，原模板、15个`%%`分隔和canonical marker保留，没有强迫逐段单条                                               |
| 16项仅t7字段无效                            | **2次HTTP**，初始16项＋仅1项回退，其余15项不重发                                                                        |
| 两项整体JSON坏                              | **3次HTTP**，初始2项＋两项各单条回退一次                                                                                |
| 坏marker单条回退仍坏                        | **2次HTTP**，只有健康项写缓存，坏项不缓存                                                                               |
| Google/Microsoft各101项                     | 两者均 **[100,1]** 两批；格式、换行、语言、provider、context隔离通过                                                    |
| MT编码载荷                                  | 原编码后预算与Google/MS限制保留；代表性超预算组合拆开且每批低于32KiB；超大单项沿用单条行为，不能称所有请求有32KiB硬上限 |
| 页面4个真实在途，受控5ms传输                | max=**4**，5次开始时间`[100,100,100,100,105]`；输入在页面饱和时独立调度                                                 |
| 取消/超时/部分回退                          | 原有迟settle仍占额度、跨标签隔离、取消不重试/晚回填/晚写缓存用例通过；DeepLX原能力探测/协调/降级3项通过                 |

默认16项请求`messages`内容为1660字符/1660 UTF8字节；同一flat JSON输入中压缩HTML属性461字符，对照canonical为685字符。字符、字节和请求数均不是计费token。完整矩阵：[LLM报告](llm-report.md)、[真实SDK HTTP证据](llm-sdk-http-evidence.json)、[MT报告](mt-report.md)、[MT量化数据](mt-measurements.json)。

本轮未读取用户持久配置或修改模型/账号；量化使用显式候选配置，不声称用户当前实际设置必为16/4000。纯机器翻译不因术语功能自动切收费模型。

## 发现并修复：空有效词条集合额外清冷缓存

本轮5ac同步适配在内容端对所有启用术语的LLM任务追加全局revision。默认术语开启，因此即空库revision0也改变无术语缓存身份；不相关编辑亦会让匹配仍为空的段落额外发请求。这不是55b原件要求，也不属于原降本实现。

真实`translateTextCore`回归先出现3FAIL/2PASS：开启空库、空匹配revision变化、空→匹配→删除至空，三种等价无术语缓存均未复用。非空revision及删除后不能复用约束结果的对照保持通过。最终有效provider fixture由独立reviewer在内存恢复旧条件再次复现，未改磁盘或关闭指纹守卫。

最小修复：只在**非空有效术语集合**下给内容缓存追加revision。请求继续携带真实revision，后台非空盐、batch/dedup key的revision＋有效集合、取消、强制重译和marker/公式检查均不改。

修复后五项通过：

1. 关闭术语→开启空库，1次后台请求后复用。
2. 空匹配revision改变，1次后台请求后复用。
3. 非空匹配revision改变，仍产生新缓存身份。
4. 删除最后匹配词条，不能复用带旧术语约束的结果。
5. 空→非空→删除至空，只请求无术语和受约束两次，最后恢复等价的原无术语缓存。

[架构复审](cache-scope-arch-review.md)通过，D5与admission spec先同步；`translateTextCore`图影响HIGH/4直接消费者，已在修改前告知用户。其fork wrapper直接re-export核心，只覆盖准入验证，无需复制或修改另一核心。只更新这一已审源指纹`0922c52288897f74 → 7127f4edfbd63b03`，其余既有项未刷新，见[指纹对账](redirect-fingerprint-review.json)。

真实术语删除持久化/matcher失效的旧F02问题未被本修复关闭；测试从明确的匹配快照验证缓存身份，不能替代真实删除生命周期。

## 测试与工程证据

- 新增三个真实路径测试文件：LLM 9项、MT 14项、内容缓存5项，共28项。定向子集的主动`-t`过滤不冒充全套；汇总以最终全套为准。
- 最终主套件：478文件、4998通过；1外部文件/4测试按`SKIP_FREE_API=true`有意跳过。
- 最终fork套件：119文件、997通过、无skip。日志`main-tests-final.log`、`fork-tests-verified-final.log`。
- 新生产/测试/辅助脚本定向lint/type-check及格式检查通过；全仓type-check仍有此前8条脚本诊断，不记为全绿。
- 固定55b边界、当前dirty/untracked补充检查、品牌、strict规格及构建通过；独立复审44/44通过，旧条件反向恢复3FAIL/2PASS。图全量返回25符号/16个tracked文件/2流程，MEDIUM；不覆盖CSS、untracked和动态redirect盲点，也不替代修改前核心HIGH影响提示。未提交、push、发版、归档或推进已接纳1.46.6元数据。
- 来源、文件/源hash、原包备份、新包状态以[artifact.json](artifact.json)和[result.json](result.json)为准。新包更新不等于用户浏览器已重载执行；本轮没有浏览器请求计数或真实付费usage验收。

新包`.output/cost-preservation-fix/chrome-mv3-global`共208文件，tree SHA256为`ea64d7beb343a260ac468f4c13ab2f6f8b08c8f697b3e30afd981ce4055a7e02`；已更新原Downloads加载目录，上一包单独备份。manifest与14项环境配置hash保持一致，历史5份构建未覆盖。最后逐文件及源码hash复核见[final-artifact-recheck.json](final-artifact-recheck.json)。用户只需重载一次，无需删除扩展或重填配置；当前状态仍为等待重载，不能追认本包真实运行验收。

## 保留的成本取舍与限制

- 不同有效术语集合继续拆批；1/2/16组的真实SDK HTTP对照量化了这项代价。不能宣称启用复杂术语库时仍有原合批率。
- 非空有效术语仍保守地按revision失效，编辑不相关词条也可能使已有非空快照重新请求；该保护没有被本修复放松。
- 术语内容、prompt、provider、语言、格式或上下文真正变化时，旧缓存不应保证命中；本修复只恢复空有效集合的等价缓存，不承诺所有历史缓存无损复用。
- 原16/4000、并发4、MT100/32KiB仍是候选校准值；原需求5.1–5.4的真实收益发布门保持未完成。历史三页Google51次、旧小样本token统计不能作为本轮收益。
- 未重测真实模型账单/供应商质量、真实浏览器IndexedDB和全部页面性能。摘要取消无scope是原有边界，不把段落取消保护扩大为所有前置摘要。超大MT单项、真实cache-hit/cancel竞态等未覆盖项见子报告。
- H01、H02、Reddit、Telegram依用户要求继续暂缓。
