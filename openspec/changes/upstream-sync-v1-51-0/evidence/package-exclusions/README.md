# 分发包排除提案、规格、交接与回归证据

2026-10-16，按用户要求在安装ZIP和额外源码ZIP中排除仓库维护/验收材料。仅补WXT的zip.exclude与zip.excludeSources；不删除仓库文件，不修改运行逻辑，不按图片、JSON、HTML或所有Markdown扩展名全局排除。

## 原因与最小修复

WXT安装ZIP从outDir收集，源码ZIP从仓库根按include/exclude收集，后者不遵循Git ignore。修复前，历史206份证据中204份会进入源码ZIP，源码收集还可能包含Git忽略的本地日志。

- 两类ZIP均排除openspec、docs、readmes目录及根UPSTREAM_FOLLOW_UPS.md；覆盖提案、规格、验证、交接、网络记录、截图、测试样本和验证脚本。
- 源码既有assets/repos排除保持；源码审查必需的SOURCE_CODE_REVIEW.md构建说明、源码、锁文件、配置保留。
- 普通插件安装包原本没有这些材料；额外exclude也防止以后误复制到outDir后进入ZIP。
- GitNexus索引刷新到4882454b；wxt.config.ts上游影响LOW/1个直接配置消费者，无识别到的运行流程。WXT动态读取及pack CLI由实际安装源码和归档检查补证，未将静态图当作全部调用链。

## 回归与真实产物

两个回归使用实际WXT配置和其同一Tinyglobby，在真实临时目录选择文件，含运行图片/JSON/HTML、源码资源、LICENSE和构建说明正向对照。修复前安装选择14项而非5、源码16项而非6，两项均RED；修复后两项GREEN，相关4文件35项通过。独立复审PASS，另验两项、定向类型感知lint和格式通过。

实际调用WXT的zip --sources，隔离输出到.output/package-exclusions-20261016，生成并读取两个真实ZIP。该显式sources参数执行与Firefox默认生成源码ZIP相同的打包分支；本轮没有声称重新运行Firefox浏览器。

| 产物                               | 文件数 | 压缩字节数 | 检查                                                        |
| ---------------------------------- | -----: | ---------: | ----------------------------------------------------------- |
| translatebuff-1.6.0-global-zip.zip |    208 |  7,017,783 | 禁止目录/文件零命中；208个运行文件与既有1.6.0候选逐字节相同 |
| translatebuff-1.6.0-sources.zip    |   1263 |  3,319,231 | 禁止目录/文件零命中；抽查7个重建必需文件内容与工作树一致    |

逐项文件名、SHA256和正向对照见[archive-check.json](archive-check.json)。源码ZIP快照生成时的工作树与后续仅在被排除的OpenSpec目录内添加的证据分开记录；未重写原有历史报告、截图或冻结构建，也未更换用户浏览器当前加载的旧包。

最终主套件479文件5000项通过，4项外部服务测试按SKIP_FREE_API=true约定排除；全仓NX格式、类型感知lint、固定55bcef边界、品牌和OpenSpec strict通过。初次图全量返回10符号/6个tracked文件/0流程LOW，未报告partial/truncated/error；新增文件和WXT动态打包不由该图覆盖，另以dirty/暂存/未跟踪边界补查和实际ZIP补证。既有产品验收缺项保持，不将本包检查扩大为真实网站或正式发布验收。

复核命令：SKIP_FREE_API=true pnpm run test scripts/**tests**/package-exclusions.test.ts scripts/**tests**/pack-test-edition.test.ts scripts/**tests**/assert-fork-build.test.ts src/fork/identity/**tests**/store-listing.test.ts。

本轮完整原始RED/GREEN、类型及构建日志按仓库既有ignore留在本地，结果与实际产物清单随代码记录。打包修复不关闭F01/F02、完整商业请求归属、真实成本等既有验收缺项。
