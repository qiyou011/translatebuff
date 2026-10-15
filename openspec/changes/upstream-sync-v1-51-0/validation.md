# C：验证与接纳状态

状态：实施中，候选未接纳，未发布、未提交商店。

## 合并前基线

- 工作树：feat/upstream-sync-2026-10-15，业务起点4be99b34。
- `SKIP_FREE_API=true pnpm run test`：378文件通过/1跳过，3781测试通过/4跳过，28.84s。日志`/tmp/translatebuff-upstream-sync-baseline.log`。
- `SKIP_FREE_API=true pnpm run test --config vitest.fork.config.ts src/fork`：96文件/795测试通过，8.39s。日志`/tmp/translatebuff-upstream-sync-fork-baseline.log`。
- `jy-openspec validate upstream-sync-v1-51-0 --strict`通过。

## G1—G7

| 门禁                 | 状态                   |
| -------------------- | ---------------------- |
| G1固定来源与完整合并 | 来源已冻结；合并待执行 |
| G2贡献/冲突/指纹     | 待完成                 |
| G3商业四层隔离       | 待源码和真实网络验证   |
| G4本仓功能/UI及15项  | 待回归                 |
| G5工程/构建          | 基线通过；合并后待验证 |
| G6迁移/回退/真实包   | 待验证                 |
| G7发布隔离           | 待实施与复核           |

待补实际候选SHA、产物hash、三上下文网络、浏览器覆盖和升级恢复证据。任何缺项不得推进lastSynced元数据。

## 分模块实施验证

- 页面引擎：68文件通过，983项通过、4外部skip；公式缓存/术语revision先RED4→GREEN15；脚注保护先RED→GREEN3。日志 `/tmp/sync-engine-suite-final.log`。
- 后台/自有队列/术语：10文件120测试通过；新术语RED4→GREEN4；后台单独57通过，范围类型格式通过。日志 `/tmp/translatebuff-queues-glossary-full-base.log`。
- root基础UI：4文件14项通过；scripts8文件84项通过。
- 初次合并后全套：8文件失败/462通过/1skip，4841通过/9失败/4外部skip；集中在划词适配中及未登记的新准入redirect，正在修复，尚非全绿。
- 依赖已下载链接：pnpm12.10.1、Node26.11.1，WXT prepare通过。代理失败后仅本进程直连，不改全局配置。

## 最终源码候选检查（浏览器回归前）

- 主全套477文件通过/1外部skip，4993项通过/4外部skip；fork全套111文件、894项通过。日志 `/tmp/translatebuff-sync-{main,fork}-final-2.log`。
- 全局type-check和fmt:check通过；cn Chrome/Edge/Firefox构建通过。Chrome域名断言通过，保留上游字面量告警，未作为网络证据。
- 架构审查通过；独立代码审查发现术语混批缓存1项、Shadow DOM敏感标签与父frame禁用2项P2，均先RED修复并独立复审关闭。术语复审2/2、隐私/iframe新增5/5及原复现/对照8/8通过。
- 旧源码迁移/备份恢复5/5通过、0skip，证据见evidence/config-migration；不等同旧包或浏览器回退。
- 58重定向：原46中23源未变、23已对账适配，新增12个准入薄包装，候选源指纹已登记。完整接纳基线仍未推进。
- 12选择性来源全部进入目标，113文件例外清零；12份原样上游changeset已被正式目标消费，本轮跟随目标删除，Git历史保留。残余fork贡献由明确接缝和回归保留，未将113文件整体白名单化。

首轮真实CFT151启动已完成，但脚本遗漏默认provider引用导致配置无效回落MT，多数断言失败；该失败记录保留，修正测试配置后重跑。不得把首轮报告中的零请求观察当作通过。

发布隔离premerge：release/submit job=false；forkguard固定55bcef+Node26.11.1，主+fork测试、类型格式。YAML、bash语法、分支模拟通过，scripts测试8文件84用例通过。提交前detect_changes scope=all：13文档/CI文件，0代码符号，无partial/truncated；不是功能影响为零的证明。
