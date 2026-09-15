# 页面翻译降本 Implementation Plan

> 执行方式：用户授权在当前任务内按 jyopsx-apply-change 逐项实施，结合 test-driven-development；不自动提交、推送或归档。

**Goal:** 降低页面 LLM token 与免费 MT 请求洪峰，并隔离交互请求。

**Architecture:** 两个页面 BatchQueue 共用一个有在途上限的 RequestQueue；交互请求单独 RequestQueue，字幕沿用原路径。协议转换在 fork 叶子完成，原缓存和 DOM 接收 canonical 标记。

**Tech Stack:** TypeScript、WXT MV3、AI SDK 7、Vitest、现有 BatchQueue/RequestQueue。

**Spec:** `specs/page-translation-batching/spec.md`。

## Context

现有页面队列同时承接输入翻译；LLM 使用 %%，计数错配可整批重试三次。Google 单条、Microsoft 数组但不能处理 HTML。实际任译喵使用自有 openai-compatible 网关，不是上游 hosted JSON schema 路由；网关已有 json_schema 拒绝记录。

## Goals / Non-Goals

实现协议降本、免费线路批量、真实在途约束、默认对迁移。保留选择引擎、缓存、模式、预翻译范围、sentinel、用户提示、用户推理选项和字幕行为。不修改后端计费路由、上游 schema/message/migration/constants，不新增用户配置、遥测、持久化能力探测或通用队列框架。

## Global Constraints

- 仅 v1.4.0 新包生效；fork version 与 upstream package version 独立。
- 参数候选为 LLM 16/4000、MT 100 条、页面并发 4；发布前实測定档。
- MT 使用 UTF-8 编码后请求项计量并预留固定 envelope 开销，候选单批 32 KiB；超大单项不拆语义，走原单条路径。
- 用户精确旧配置 4/1000 才迁移；其他值不覆盖。独立 migration 标记先成功写 config 再写标记，失败可重试。
- 所有新业务和测试位于 src/fork/page-translation；原地接入文件经本次复审批准。
- 测试必须 SKIP_FREE_API=true；单测不等于实机或真实费用验收。

## Decisions

### D1 双通道与最小接入

共享队列方案不能隔离交互；provider×tab 多层池增加不必要状态。因此选择用户确认的双通道：

```text
页面消息 → LLM BatchQueue / MT BatchQueue → 页面 RequestQueue → adapter
输入消息 → 交互 RequestQueue → 原 adapter
划词流式 → 保持现有独立流式路径
字幕 → 保持原队列
```

`background/index.ts` 注入 fork 页面工厂，`translation-queues.ts` 接入交互路由并保留缓存/消息注册/summary/cancel；输入的前置 summary 同样使用交互队列。不注入工厂的上游测试路径保持原队列。`background/config.ts` 共享同一个带迁移的初始化 Promise。白名单另增 `request-queue.ts`、`api/google.ts`、`api/microsoft.ts` 和 `.changeset/page-translation-cost-reduction.md`。后者仅记录发布，不运行 changeset release/version。

### D2 真实并发与取消

RequestQueue 新增可选 `maxConcurrent`，未设置保持旧行为。单独记录尚未 settle 的 thunk；timeout/cancel 会中止信号并提前结束逻辑任务，但不能提前释放真实调用额度。错误分类与底层调用都结束后才释放额度，避免在401清队列、429暂停之前放行下一请求。满额时不创建 0ms 轮询；完成事件唤醒队列，dispatch gate 满额返回有限延迟。重试同样受上限。

page batch、dedup、下游 request hash 都包含 scope；不跨 session/tab 合并在途任务，持久 cache 继续共享。取消先处理 pending batches，再 requestQueue；fallback 及缓存写入前重查 scope。一个取消的页面不得取消另一个页面的相同正文。代价是降低跨标签在途复用；双标签验证必测。

### D3 请求快照和批次契约

入队时冻结 provider config、完整语言、prompt config 和 context；使用 `getLanguageModelForConfig`，不重新按 id 读取模型。分桶键哈希覆盖 provider 完整快照、提示完整快照、语言、context、format、preserveLineBreaks、scope 和 feature；只存 hash，不打印密钥或请求正文。

```ts
type ItemOutcome = { ok: true; value: string } | { ok: false; error: Error }
// BatchQueue<Data, ItemOutcome>；maxRetries=0，enableFallbackToIndividual=false
// executeBatch 返回等长 Outcome；enqueue 调用边界把失败转换为 reject。
```

网络队列只负责发请求和读取原始响应；JSON/MT shape/marker 校验在 queue.enqueue 的 await 之后执行。成功项保留，可定位失败项逐条降级一次；无法确定位置的 envelope 损坏才整批失败。降级请求在队列外重新入队，防止占槽重入死锁。SDK maxRetries=0；网络及 429 沿用 RequestQueue 唯一预算，认证/取消不触发协议降级。单条降级再失败即 reject、不缓存。

### D4 默认协议及 HTML

默认模板采用 JSON `{t0: text, ...}`，严格拒绝未知/重复 key，缺失/空/非字符串值为该项失败。key 解析不能让 JSON.parse 静默覆盖重复键。保留 sentinel，不把 sentinel 当空失败。其他内置及自定义模板使用原提示和 %% 协议，不做模板改写。

仅默认 HTML 输入在 wire 层将真实属性 `data-rf-attr=N` 改为短 `id=N`，保留标签名；SW 不使用 DOM。扫描器跳过注释及 raw-text 节点，按引号识别真实属性，原生 id 冲突时该段保留原协议兼容路径，与紧凑协议分桶。ASCII大小写转换保持扫描偏移，自闭合标签保留属性值与斜杠的分隔。wire 输出恢复为 canonical 后再调用既有完整性校验；未知/重复/错标签均不允许回填。缓存 key 和缓存结果协议不变；sentinel 明确跳过 marker 回填校验，因为其含义是无需替换。

任译喵沿原网关生成链，用 JSON mode 而非 native json_schema。其他模型可用纯 JSON 指令+客户端校验，不依赖全体引擎支持严格 schema。自有 credentials、reasoning、temperature、providerOptions 不可变复制及保留；确切不支持 JSON mode 时走一次旧单条降级，不能将任意 400/401/429 都当协议不支持。

### D5 MT 传输复用

Google 抽出原单项准备/恢复函数，数组一次 fetch，每项保留本身换行语义；Microsoft 复用裸字符串数组端点，拒绝 html。新增 raw 响应入口供 page 校验，旧导出语义不变。数量不一致无法确定对齐，整批协议失败；数量一致时个别缺失只重试该项。输出只经既有 normalizeTranslationOutput 解码一次。

### D6 默认对迁移与发布门

独立 storage key 记录本次迁移，不改上游 schemaVersion。初始化共享 Promise：上游 init → fork migration → 原 init result。失败不写成功标记；下一次初始化可重试。写前重新读取实际配置，仅成对旧默认替换；复制保留其他字段和字幕设置。发布默认候选需在校准报告通过后冻结，不把内部开发候选当已验证发布值。

## 文件职责与实施接口

| 文件                                                        | 职责 / 主要接口                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| src/fork/page-translation/policy.ts                         | 候选参数、纯迁移对判定                                              |
| src/fork/page-translation/migration.ts                      | initializePageTranslationDefaults(): Promise<void>，独立storage标记 |
| src/fork/page-translation/wire.ts                           | encode/decode紧凑属性和flat JSON逐项解析；不联网                    |
| src/fork/page-translation/llm.ts                            | 默认/原协议prompt、快照model和SDK请求，纯解析分离                   |
| src/fork/page-translation/queues.ts                         | createPageTranslationQueues(config)，两种批次、Outcome、单项降级    |
| src/fork/page-translation/**tests**/*                       | 所有新增行为测试和实际redirect集成测试                              |
| src/utils/request/request-queue.ts                          | 可选真实maxConcurrent；不改字幕默认                                 |
| src/utils/host/translate/api/google.ts、microsoft.ts        | 原接口不变，批量raw入口、单项编解码复用                             |
| src/entrypoints/background/translation-queues.ts、config.ts | 最小消息/配置初始化接入                                             |

## 验证步骤

每项先写可观测失败测试，跑红，再实施跑绿。队列测试真实 thunk 延迟，不用测试私有map替代实际调用峰值。

```ts
// 并发回归的手工期望：cap=2时三个未完成任务只能发起两个。
expect(started).toEqual([0, 1])
finishFirst()
await flushPromises()
expect(started).toEqual([0, 1, 2])
// 默认对迁移：只变成对旧默认，不覆盖4/2000。
expect(migratePair({ maxItemsPerBatch: 4, maxCharactersPerBatch: 2000 })).toEqual({
  maxItemsPerBatch: 4,
  maxCharactersPerBatch: 2000,
})
// 局部协议失败：t1缺失仅重发第二段，不重发t0。
expect(retriedTexts).toEqual(["second paragraph"])
```

基线：原队列三文件 105/105 通过（2026-09-12）。依次跑fork新增单测、原queue/Google/MS/markers/ai回归、全量root和fork redirect套件、type-check、格式、diff check、fork边界实际未提交路径分类、Chrome/Edge/Firefox构建。

## Risks / Trade-offs

Google impact HIGH，必须保留连通性检测等单条调用。慢请求忽略abort时上限仍占用，此时宁可等待真实settle，不制造超额请求。缓存命中不能算首次降本，模型输入成本包含所有schema、协议、重试及降级。默认模板之外不承诺同等token收益。

回滚分两包：LLM协议/迁移接入；MT批量/页面cap接入。撤本次精确增量并重建，不重置分支、不删缓存、不改用户配置。撤销实现后保留已设置的用户批量值，不自动逆迁移。

## Open Questions / 发布验收

没有阻断实现的产品决策。仍缺原调研的冻结原始快照和六类模型实机凭据/环境；可重新采样并记录新基线，但不能直接沿用旧339/1001数字。

- 三固定快照：Wikipedia Machine translation、React Thinking in React、MDN JavaScript Functions；真实引擎取文，固定lang/mode/preload、无cache、同o200k_base。
- LLM 4/1000、8/2000、16/4000比较；输入token目标约57%、门槛候选≥50%，质量/marker/失败不退化。
- 六类模型：任译喵网关、OpenAI/Responses、Anthropic、Gemini、Qwen/GLM兼容、弱/本地模型；每类协议单测与真实请求证据分开。
- MT三页≤30请求目标、live首次请求降≥90%；并发2/4/6、首结果多次median≤基线+20%，交互延迟不退化；总耗时只观察。
- 实际浏览器滚动/点击/输入与CPU长任务证据，不能用网络次数推定卡顿已解决。
- 以上未通过的任务保持未勾选；未发布、未提交、未推送。
