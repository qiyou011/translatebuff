# 1.5业务分支回流与Windows迁移测试

日期：2026-10-19。合并前1.6代码为59f107c8；来源为origin/feat/1.5.0的f89d64189a68cb35e113dbdc1ff55afa2837b20d，两个分支共同起点4be99b34。此次保留完整merge历史，无文本冲突。发行版仍为1.6.0、上游引擎固定1.51.0，已接纳基线保持原状态。

## 改动

- 合入官网兑换入口和九语文案；仅海外显示，已登录直达兑换、未登录保留编码后的兑换意图回跳；语言及每次点击的当前渠道保留。国内不显示，原登录入口可用。不扩展独立兑换余额、比例或到期展示。
- Windows故障来自测试加载器把Git tree的正斜杠路径交给原生path.join/normalize。仅改为posix.dirname/join；本机ROOT继续原生dirname/resolve。生产迁移、冻结旧源码、fixture、skip条件均未改。
- changeset使用海外入口口径，allowlist仅登记该changeset精确路径；edition分叉登记到现有索引。打包配置未修改，此证据目录仍被openspec排除规则覆盖。

## 验证

| 检查                                | 结果                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| 兑换国内负例RED                     | 9FAIL/9PASS；失败原因为国内仍显示按钮                                                           |
| 最终兑换UI/URL                      | 21PASS，覆盖两线、未登录/free/pro、简中/英文/未上线语言回落、二次点击重读渠道及国内登录入口保留 |
| 迁移及迁移安全两文件                | 11PASS，无skip                                                                                  |
| 实际legacyRequire的路径模拟         | 旧源码3FAIL/3PASS；修复后6PASS，覆盖相对文件、目录、父目录、alias和POSIX对照                    |
| 主测试套件                          | 5021PASS，4项免费外部在线服务测试按SKIP_FREE_API=true跳过                                       |
| fork套件                            | 1018PASS，无skip                                                                                |
| 全仓type-check及fmt:check           | PASS；合并后执行wxt prepare刷新本地i18n类型                                                     |
| 固定55b边界、品牌、strict规格       | PASS                                                                                            |
| cn/global Chrome构建及域名/环境断言 | PASS；两包manifest均1.6.0（rf1.51.0），见build-result.json                                      |
| 独立代码复审                        | PASS，未发现必须修复问题                                                                        |

主套件日志仍含既有jsdom导航及第三方sourcemap提示，fork日志含jsdom scrollTo提示；实际退出码均0，不把提示描述成零警告。

编辑前ForkAccountMenu影响LOW，直接调用为Popup App。测试legacyModule图中未收录，源码补查其调用仅在该测试内部，不能把UNKNOWN视作无影响。刷新后的useOpenForkRedeem影响LOW，直接调用ForkAccountMenu、间接Popup App；提交前完整图结果见graph-detect-all.json，测试/构建/独立审查补足图未收录路径。

## 复现命令

从项目根执行，所有测试均设置SKIP_FREE_API=true：

```sh
export SKIP_FREE_API=true
pnpm test src/fork/ui/popup/__tests__/account-menu.test.tsx
pnpm test src/fork/__tests__/upstream-v151-migration.test.ts src/fork/config/__tests__/upstream-migration-safety.test.ts
pnpm run test
pnpm run test --config vitest.fork.config.ts
pnpm run type-check
pnpm run fmt:check
```

路径模拟直接执行当前测试文件内的真实legacyRequire，不复制另一套路径算法；文件存在性由冻结Git tree验证：

```sh
node openspec/changes/upstream-sync-v1-51-0/evidence/v150-merge-and-windows-migration/migration-loader-regression.mjs 59f107c8
# 预期退出1，三个Windows相对导入失败
node openspec/changes/upstream-sync-v1-51-0/evidence/v150-merge-and-windows-migration/migration-loader-regression.mjs
# 预期退出0，六项通过
```

## 验收边界

本轮运行平台为macOS；Win32 API模拟不等于真实Windows整套运行。官网兑换的真实登录回跳、最新包覆盖升级/回退及Edge/Firefox运行未在本轮完成。原F01/F02、G5和H01/H02/Reddit/Telegram暂缓范围不因本轮通过而关闭。此目录材料不会进入插件分发包。
