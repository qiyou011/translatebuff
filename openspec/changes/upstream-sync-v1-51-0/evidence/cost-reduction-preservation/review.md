# 降本保留性及空术语缓存修复独立复审

结论：**PASS，未发现阻断问题**。审查基于 HEAD `e1d90dc928ca5fbbbba112e480131e1c909c93ce` 的当前工作树；本轮生产修复仅审 `src/utils/host/translate/translate-text.ts` 的空有效术语条件及注释，不覆盖此前 UI 修复或整体发布验收。

## 正确性与最小边界

- `translate-text.ts:356` 一次取得实际 terms/revision，`:371` 将同一 terms 交给真实 prompt/hash，`:386` 仅在有效 terms 非空时保留 revision 标签，`:441` 仍将真实快照发给后台。`src/utils/prompts/translate.ts:141`、`src/utils/glossary/prompt.ts:74` 对空 terms 不追加术语块，因此同文本、provider、语言、prompt、上下文及其他 hash 参数下，与无术语缓存等价。
- 非空 terms 的 prompt 与 revision 隔离仍在；`src/entrypoints/background/page-translation.ts:95` 的非空 terms/revision 盐未改，`src/fork/page-translation/queues.ts:34` 的严格 revision + canonical terms 分组未改。删除末条术语后不会读入带约束的缓存；若先前存在等价无术语结果，允许恢复它。当前修复未归零消息 revision、移除请求术语或放宽分组。
- MT 不进入新增 revision 标签分支；force-retranslation、取消门、公式/原子完整性缓存守卫均未改。不同 matched terms 集合仍可能将 16 段拆成 1/2/16 次请求，属于已批准的正确性取舍。
- `src/fork/upstream-services/page-translation.ts:6` 真实 re-export core，只覆写配置验证；redirect 插件对目标 wrapper 导入原源的放行逻辑仍在。无需复制 core 到 wrapper。

## 独立验证

全部设置 `SKIP_FREE_API=true`，不运行全套、build 或浏览器。

1. 最终有效 provider model 对象 fixture 下，以 Vite 内存 transform 仅移除真实 core 的 `glossaryTerms.length > 0 &&`，确认该源只变换一次，磁盘源码和指纹守卫保持原样。结果 **3 FAIL / 2 PASS**：开启空库、不相关 revision、empty→term→delete 的等价缓存恢复三项变红；非空 revision 隔离和删除后不得复用带术语结果两项保持通过。见 `review-cache-red.log`。
2. 不加 transform，运行 content、LLM、MT、glossary、background 五文件，结果 **44/44 PASS（5 files）**；content 最终有效 fixture 5/5 PASS。该命令无 `-t`，没有主动 deselected；不是全库结果。完整命令与结果见 `review-tests.log`。
3. 独立重新逐字节比较 history audit 中九个保留核心文件，均同时等于业务 `4be99b34` 与原实施 `0906e791`。不把仍有术语适配差异的 queues/LLM/types 说成完全相同。见 `review-source.log`。
4. 当前真实 LF-normalized SHA256 前 16 位为 `7127f4edfbd63b03`，原为 `0922c52288897f74`；相对 HEAD 只有这一条已存指纹更新。59 项中的另一新增项是此前已审 NoteSuggestion UI 叶子，不属于本轮刷新。wrapper、redirect 插件、fork queue/LLM、后台 cache 盐相对 HEAD 均无新增 diff。源文件原已 allowlisted；本轮新增 release 说明是精确 `.changeset/fix-empty-glossary-cache-cost.md` 路径，其他 allowlist 规则未变。见 `review-source.log`，与 `redirect-fingerprint-review.json` 一致。

反转实验的第三项 RED 返回“术语甲在河边”，来自 fixture sender 对新增 dispatch 的固定回复；它证明旧条件没有复用等价缓存，不能将这一模拟回复解读为旧实现后台错误命中术语缓存。两项隔离对照及真实 hash/prompt 源码支持本次未降低删除正确性的结论。

## 证据等级与限制

- Content 5 项使用真实 core、hash、prompt、provider 准备和内存缓存；matcher、配置和消息边界受控。证明内存缓存身份与 dispatch 次数，不证明 matcher 在真实页面的删除通知生命周期。
- LLM 9 项使用真实工厂、队列、provider/AI SDK 和 fetch 请求构造；响应是受控 HTTP 格式 fixture，DB 为 Map。16 段 1 次、不同术语分组 1/2/16 次、局部 fallback 和缓存写入是可重复协议证据，没有真实供应商请求、模型 token 或账单证据。
- MT 14 项使用真实队列与 Google/Microsoft transport，请求响应受控；101→100+1、受测 escaped ASCII payload 的 32KiB 分批、maxConcurrent=4 可复验。input execute 是 mock，时间是模拟时间；独立队列调度结果不能解释为真实网络 0ms。Map 缓存不等于真实 IndexedDB 持久化；不将受测多项载荷边界扩展为单条超大语义项的硬拆分承诺。
- 不认定真实浏览器页面质量、供应商限流、费用/token 节省比例或线上时延已验收；原降本发布指标仍需独立真实服务证据。父代理负责全套与最终构建，本复审不转述为自己的独立执行结果。

本次仅新增本目录 `review.md`、`review-tests.log`、`review-cache-red.log`、`review-source.log`，未修改生产、测试、配置或其他证据文件。
