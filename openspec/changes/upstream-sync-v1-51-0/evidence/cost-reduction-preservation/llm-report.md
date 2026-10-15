# LLM 页面降本机制保留验证

结论：限定范围内 **48 项定向验证通过**。默认兼容模板的16个短段实际合成1次SDK HTTP请求。自定义模板保留原 `%%` 协议，单条回退继续使用原模板。术语有效集合隔离会降低合批率，不能据此宣称所有页面调用率或费用不变。

工作树为本轮 upstream-sync-v1-51-0，HEAD=e1d90dc，业务起点4be99b34，固定上游55bcef1e。本轮**没有生产修改**，只新增指定 `src/fork/page-translation/__tests__/cost-preservation-llm.forktest.ts` 和本目录 `llm-*` 证据。

## 真实链路与受控边界

`setupPageTranslationHandlers → createWebPageTranslationQueues(factory) → createPageTranslationQueues → BatchQueue/RequestQueue → requestPageLlm → 真实provider factory/AI SDK → fetch`。

没有 mock batching、队列、prompt/wire/helper、provider factory或AI SDK。只有浏览器消息注册、已初始化配置/DB、HTTP网关边界受控；网关URL严格限制为 fixture `.invalid` 地址。完整实际SDK请求体和缓存边界记录见 `llm-sdk-http-evidence.json`，没有保存请求头或API key。

缓存在本轮只验证DB边界的准入、key与写入；真实Dexie持久性和正式构建接线由root负责。

## 可计数量化

以下字符与字节均为真实SDK请求 `messages` 的内容总和，包含系统提示和用户提示，但不含chat framing及HTTP JSON转义。

| 场景                              | 实际HTTP数 | 每次代表的原请求数 | 有效cache边界写入 | messages字符 | UTF8字节 |
| --------------------------------- | ---------: | ------------------ | ----------------: | -----------: | -------: |
| 默认模板，16项无术语              |          1 | [16]               |                16 |         1660 |     1660 |
| 16项同revision，同一有效terms集合 |          1 | [16]               |                16 |         2436 |     2444 |
| 16项同revision，两个有效terms集合 |          2 | [8, 8]             |                16 |         4406 |     4422 |
| 16项同revision，16个有效terms集合 |         16 | 16次单项           |                16 |        32076 |    32204 |
| 自定义模板，16项legacy协议        |          1 | [16]               |                16 |         2325 |     2329 |
| 16项仅t7非字符串，一次单条回退    |          2 | [16, 1]            |                16 |         3049 |     3049 |
| 2项：坏marker且单条仍坏           |          2 | [2, 1]             |                 1 |         2645 |     2645 |
| 2项：整个JSON非法                 |          3 | [2, 1, 1]          |                 2 |         4034 |     4034 |
| 2项自定义模板：一次marker单条回退 |          2 | [2, 1]             |                 2 |         2397 |     2401 |

默认请求实际发送 `response_format: {type:"json_object"}`。输入键为 `t0` 至 `t15`，HTML为 `<a id=0>Source 0</a>`；结果恢复成 `<a data-rf-attr="0">译文 0</a>`。16项有效结果进入缓存边界后，重发相同消息不新增HTTP。

同一flat JSON载荷仅比较属性编码：compact为461字符，canonical属性为685字符，相差224字符。这只是同一JSON输入的属性压缩差值，不是历史整体prompt变化或模型token节省。

自定义模板实际保留 `MY CUSTOM SYSTEM`、`CUSTOM_INPUT`、canonical `data-rf-attr` 和15个独立 `%%` 分隔行，无JSON mode。非默认模板不会强制每段单条；其单条降级请求仍逐字保留原模板及canonical输入。

**术语取舍：** `getPageBatchKey` 包含revision和稳定排序的完整有效terms集合。同revision不是可合批的充分条件。1/2/16组对照证明，正确术语约束和缓存隔离确实换取合批率；本轮没有放松该规则。

**tokens限制：** 未调用真实模型，没有真实网关usage或该fixture模型tokenizer，`actualModelTokens` 明确为null。上述字符/字节不能当作付费tokens、真实服务成本、模型质量或财务节省证据。

## 覆盖矩阵

| 维度                       | 当前机制证据                                                                                    | 结果                 |
| -------------------------- | ----------------------------------------------------------------------------------------------- | -------------------- |
| N=16合批与默认紧凑协议     | 真实后台→队列→SDK HTTP；16项1请求，恢复16项marker；缓存命中不新增HTTP                           | PASS                 |
| 自定义prompt与单条兼容     | 16项legacy合批；坏marker仅1条回退，仍原模板/canonical输入                                       | PASS                 |
| 术语revision与有效集合隔离 | 既有4项glossary回归；新增1/2/16组HTTP计数；修改/删除、集合顺序及fallback约束覆盖                | PASS，存在合批率取舍 |
| 缓存key及坏结果准入        | 既有后台修改/删除与同revision不同有效集合回归；坏marker单条仍坏时，仅好项写入1次                | PASS，仅DB边界       |
| JSON逐项错误与整包异常     | t7非字符串只补1次；2项整JSON坏共3次HTTP；401既有回归不转单条fallback                            | PASS                 |
| marker、公式与sentinel     | wire缺失/重复/未知/tag变化、sentinel回归；真实prompt保留Protected Placeholder规则；坏公式不缓存 | PASS，仅机制         |

## Fresh 验证

- `llm-existing-core.log`：llm 7项、wire 17项、glossary 4项，合计28 PASS，exit 0。
- `llm-existing-queues.log`：3 PASS，4项按范围过滤，exit 0。
- `llm-existing-background.log`：8 PASS，4项按范围过滤，exit 0。
- `llm-sdk-http.log`：新增9 PASS，exit 0。
- 总计48 PASS；没有重跑MT、并发或全套测试。均设置 `SKIP_FREE_API=true`，没有live free API调用。
- 新测试 `oxfmt --check`、`oxlint --type-aware --type-check`、diff检查通过。

命令、源码指纹、逐场景计数和覆盖项详见 `llm-result.json`。

## 源码、图与限制

- 与业务起点4be比较：policy和wire逐字相同；llm仅增加术语透传，queues增加revision/有效集合key和terms透传。默认紧凑协议保留，不能把术语正确性补充描述为所有场景原合批率/费用不变。
- impact：requestPageLlm为LOW/4，setupPageTranslationHandlers为LOW/1。factory原始LOW/0属于动态factory图盲点；已由 `background/index.ts:5/139` 和 `translation-queues.ts:494` 以及实际测试路径补链，没有将0caller当安全。
- 三份impact JSON已完整解析。首次经Python pipe捕获的输出被截断，已用直接文件重定向重跑，未将截断结果当完整证据。
- 真实SDK报告旧 `providerOptions["openai-compatible"]` key弃用提示，但仍接受，实际JSON mode请求体断言通过；未扩大生产修改。
- 首次 `Response(string)` 受共享Vitest TextEncoder误编码中文影响，已改HTTP fixture传明确UTF8字节。`llm-sdk-http-fixture-encoder.*` 仅为测试环境排障记录，不作产品RED或最终计数依据。
- 未进行真实模型/账单、浏览器、持久库、构建或提交验收；没有修改根文档。
