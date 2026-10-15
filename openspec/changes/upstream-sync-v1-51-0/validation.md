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

发布隔离premerge：release/submit job=false；forkguard固定55bcef+Node26.11.1，主+fork测试、类型格式。YAML、bash语法、分支模拟通过，scripts测试8文件84用例通过。提交前detect_changes scope=all：13文档/CI文件，0代码符号，无partial/truncated；不是功能影响为零的证明。
