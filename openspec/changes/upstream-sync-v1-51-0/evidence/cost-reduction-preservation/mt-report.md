# MT 批量与调度保留验证

结果：**PASS，154 项定向测试通过，0 失败**。本次只新增 `src/fork/page-translation/__tests__/cost-preservation-mt.forktest.ts`（14 项）；生产与旧测试未修改，保留已有 UI dirty。所有请求使用受控 fetch/mock，`SKIP_FREE_API=true`；未运行浏览器、账号、真实免费/付费服务或 build。

当前 HEAD：`e1d90dc928ca5fbbbba112e480131e1c909c93ce`；合并前业务基线：`4be99b341a7c940a48794232f066db43339cc2d2`；固定上游：`55bcef1e684fb4e70f4dce3063e7bd3066f46891`。

机器可读结论与完整命令、exit/count：[mt-results.json](mt-results.json)。真实断言输出量化：[mt-measurements.json](mt-measurements.json)；原始输出：[mt-new-final.log](mt-new-final.log)。

## 当前调用链与编辑前影响

GitNexus `status` 显示索引为当前 `e1d90dc`，索引时间2026-10-15 17:56:24 UTC+8。先执行 query/context，再执行影响分析，原始 JSON 均保存为 `mt-graph-*`、`mt-impact-*`。

真实链路是后台 `index.ts:139` 注入 `setupPageTranslationHandlers(createPageTranslationQueues)` → 页面 handler → fork `batchQueue` → `RequestQueue` → `invoke` → `requestPageMt` → Google/Microsoft 原生批量 transport → `decodePageMt`。输入分支走独立 `interactionQueue`。

`createPageTranslationQueues`、`requestPageMt`、`setupPageTranslationHandlers` 的预编辑 impact 均为 LOW。factory 的图 incoming 为空，通用 query 也被被索引的构建 evidence 干扰，未把空图读作“无调用”；已用当前源码补核实际注入点及 handler 分支。无生产函数编辑。

## Fresh 执行结果

每条命令都以 `SKIP_FREE_API=true pnpm run test` 开头，附 `--reporter=default --reporter=json --outputFile=<对应JSON>`；具体 argv、耗时、exit 均在各 `*-command.json` 和汇总中。

| 定向范围                                                                               | 实际测试文件 | 通过 | 名称筛选未执行 | exit |
| -------------------------------------------------------------------------------------- | -----------: | ---: | -------------: | ---: |
| fork：mt / request-concurrency / migration / config-init                               |            4 |   18 |              0 |    0 |
| 根配置：Google / Microsoft / Google roundtrip / DeepLX URL / RequestQueue / BatchQueue |            6 |  117 |              0 |    0 |
| fork queues，仅 `-t MT`                                                                |            1 |    2 |              5 |    0 |
| translate.integration，仅 `-t DeepLX`                                                  |            1 |    3 |            168 |    0 |
| 新 cost-preservation-mt.forktest                                                       |            1 |   14 |              0 |    0 |
| 合计                                                                                   |           13 |  154 |            173 |    — |

173 项为明确的 `-t` 过滤，不是失败，也不是调用外部服务失败后跳过。未跑 LLM/术语大套件。

新文件最终运行：

```sh
SKIP_FREE_API=true pnpm run test --config vitest.fork.config.ts src/fork/page-translation/__tests__/cost-preservation-mt.forktest.ts --reporter=default --reporter=json --outputFile=openspec/changes/upstream-sync-v1-51-0/evidence/cost-reduction-preservation/mt-new-final.json
pnpm run type-check src/fork/page-translation/__tests__/cost-preservation-mt.forktest.ts
node node_modules/oxfmt/bin/oxfmt --check src/fork/page-translation/__tests__/cost-preservation-mt.forktest.ts
```

三条均 exit0。初版14/14已通过；随后只修正新测试的两条 lint（afterEach 的独立 expect、RequestInit.body 类型收窄），增加不受全局 console 静默影响的测量输出，再 fresh 跑14/14。没有为制造 RED 修改生产源码。

## 批次数、隔离和缓存观测

| 场景                                                                         | 本次量化结果                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Google：同组101段                                                            | 2个 transport，批次 `[100,1]`                                                                          |
| Microsoft：同组101段                                                         | 2个 transport，批次 `[100,1]`                                                                          |
| 每 provider 两条各4001字符、含4000个 `&`                                     | 编码后不能合并，均拆 `[1,1]`；每次完整请求 body 小于32768 bytes                                        |
| provider ID/配置、source/target语言、context、plain/html、preserveLineBreaks | 13项产生11组，仅两对相同语义合批；入队后修改原 provider 对象，不影响原快照                             |
| Microsoft HTML                                                               | 入队前拒绝，0网络调用                                                                                  |
| 页面 MT 模拟单请求5ms                                                        | 最大实际在途4；5组启动时刻 `[100,100,100,100,105]ms`，第5组等待真实请求完成                            |
| 页面4槽占满时输入到来                                                        | 实际后台 routing/interactionQueue 立即调用 executeTranslate mock，等待页面0ms；页面仍4槽               |
| 同文本/同hash、两个tab，其中一个取消                                         | 每 provider 原始2次；取消结果拒绝、signal abort；晚到畸形结果不触发fallback；健康tab完成并只写1条cache |
| 取消后晚到 network error                                                     | 每 provider 20秒模拟时间后仍仅1次transport，0 cache write，无重试                                      |
| MT返回3位置，仅第2项无效                                                     | 两 provider 均 `[3,1]`，只重发缺失位置，两个健康项不重发                                               |
| 输出 `&amp;amp;`                                                             | 只解码一次为 `&amp;`，实际handler写入接口一次；另一tab复用同callerHash，增加transport0次               |

`5ms` 是受控 transport 的注入时长，不是生产请求速率；该用例使用 `rate=100000/capacity=100` 去掉 token 桶干扰，独立验证 factory 默认 `PAGE_MAX_CONCURRENT=4`。100ms 来自 batchDelay。输入 transport 被 mock，此处证明调度不排在页面后面，不证明真实输入翻译耗时为0。

取消用例故意让 transport 忽略 AbortSignal 并迟结束，验证取消后仍不会恢复对应结果、重试或写入缓存。缓存用例实际执行生产 handler/queue/codec，但 Dexie 接口由 Map 替代，因此是缓存契约证据，不能标作真实 IndexedDB 持久化或浏览器回填证据。

## 与合并前行为对照

[mt-baseline-comparison.json](mt-baseline-comparison.json)保存 read-only `git show 4be99b34:<path>` 与当前文件 SHA256：

- `mt.ts`、`policy.ts`、`migration.ts`、`request-queue.ts`、`batch-queue.ts`、`google.ts`、`microsoft.ts` 全部逐字节一致。
- fork `queues.ts` 只增加术语快照分组及术语向单条路径传递，见 [mt-queues-baseline.diff](mt-queues-baseline.diff)；既有MT100条/编码32KiB候选、页面4槽/独立交互、取消逻辑不变。
- 默认对迁移实测：仅4/1000→16/4000；4/2000、8/1000保留；字幕/provider不受影响；失败不写成功标记，下次可重试；初始化Promise共享。

这不是在旧包/旧依赖上重跑测试。对照证据是前后源码一致性与当前实际执行的断言，不能宣传为真实供应商请求减少比例、成本下降或浏览器性能达标。

## DeepLX 迁移后的探测与降级

旧位置为 `src/utils/host/translate/core/translation-modes.ts`，新位置为 `core/translation-request.ts`。创建、结束、获取 probe 的三个 helper 文本/SHA完全相同。provider key 的实现适配了新 providerRef，但仍是本地 DeepLX 的 `id:baseURL`，system和非DeepLX不参与。

只筛选的三个既有集成测试实际通过：

1. 首次 marker 失败后记住当前endpoint不支持：两段共3次请求（probe+首次legacy+下一段直接legacy）。
2. 两段并发共享首次probe：probe未结束时只有1次请求；失败后各自legacy，总计3次。
3. 首次空结果不把未知当作不支持：三段共2次串行compact probe、2次legacy；空探测交接给一个等待者，而不是全部重新探测。

这些请求是被mock的 `translateTextForPage` 调用，并非真实DeepLX服务探测。

## 未证明项

- 真实Google/Microsoft/DeepLX服务当前可达性、供应商实际限制、真实延迟/质量/计费。
- 真实浏览器、IndexedDB重启持久化、内容层回填和同页内存cache；现存cache hit恰好与取消竞态的路径本轮未测。
- 单个条目自身超过32KiB的处理；当前载荷测试覆盖多个各自合规条目不能被过度合批。
- LLM与MT混载共同饱和、真实输入服务网络耗时；本轮不与负责LLM/术语的代理重叠。
- DeepLX成功支持的记忆、短暂错误的交接未独立执行，只有源码核对；未扩大为全套integration运行。
- 真实浏览器/模型发布门与生产节省比例仍需对应独立证据，本报告不改变其状态。
