# 影响分析记录

已更新索引，按文件限定符号执行 upstream impact，limit=3000，以下七份查询未返回 partial/truncated。索引过程仍警告流程枚举被预算限制；调用图结果需结合实际入口核对，不能宣称全流程覆盖。

| 符号                             | 风险 | 直接调用者                                               | 索引流程                           |
| -------------------------------- | ---- | -------------------------------------------------------- | ---------------------------------- |
| renderInlineAtomTranslation      | LOW  | translateNodesBilingualMode                              | handleMutationRecords              |
| setupPageTranslationHandlers     | LOW  | main                                                     | main                               |
| getValidatedCachedTranslation    | LOW  | setupPageTranslationHandlers                             | setupPageTranslationHandlers, main |
| requestMicrosoftTranslationBatch | LOW  | requestPageMt, microsoftTranslate                        | 索引未给出；不得视为无影响         |
| createPageTranslationQueues      | LOW  | queue                                                    | 索引未给出；不得视为无影响         |
| createPageTranslationRequest     | LOW  | translateNodesBilingualMode, translateTranslationOnlyRun | handleMutationRecords              |
| translateVirtualParagraph        | LOW  | translateVirtualParagraphs                               | 索引未给出；不得视为无影响         |

源码补核：src/entrypoints/background/index.ts:140 将 createPageTranslationQueues 作为工厂传入 setupPageTranslationHandlers；translation-queues.ts:478 接收该工厂。高阶调用未完整进入图，因此队列的单一 evidence 调用者不能视为产品无调用。实际持久缓存写入位于 background/page-translation.ts:238，读取由 getValidatedCachedTranslation 执行。原子恢复仍由普通双语入口调用，虚拟段落需独立接入。当前未修改上述生产符号；后续新增修改目标仍须各自执行 impact。
