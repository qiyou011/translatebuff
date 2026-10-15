# schema100 → 111 与备份恢复：源码级验证

本目录证明的是 **WXT 测试存储中的真实迁移/备份函数往返**。5/5 测试通过，0 失败、0 跳过；类型、格式及 diff 检查通过。没有启动旧扩展包，也没有执行浏览器升级或真实旧包回退，Task 9.4 的浏览器验收不能据此关闭。

## 来源与复核

- 业务基线：`4be99b341a7c940a48794232f066db43339cc2d2`，该提交 `CONFIG_SCHEMA_VERSION=100`，`package.json.version=1.46.6`。这里的版本来自源码，未当作旧浏览器包 manifest 的实测版本。
- 固定上游目标：`55bcef1e684fb4e70f4dce3063e7bd3066f46891`；当前候选 schema111。
- fixture：`src/fork/__tests__/fixtures/upstream-v146-config.json`。它取自基线 `src/utils/config/__tests__/example/v100.ts` 的 `testSeries["prompt-token-migration-coverage"].config`，包为 `{schemaVersion:100,config}`。这是仓库冻结测试样本，不是生产用户导出。测试会核对整个 fixture 与基线对象相等。
- provider、动作引用、标题 false、输入设置及会员/tab 状态均为测试中显式添加的合成场景，不含真实凭据。
- `summary.json` 保存 fixture SHA256、旧源码 blob/SHA256、运行时依赖版本、当前候选 HEAD/MERGE_HEAD 与验证边界；`vitest-results.json` 和 `test-run.txt` 是实际测试输出。

读取前先运行了 GitNexus query，以及 `migrateConfig` / `addBackup` context，随后核对源码。没有改动迁移实现，也没有新造 schema、迁移规则或生产恢复接口。

旧源码校验通过测试专用 loader 执行 `git show <基线>:<原路径>` 的源码：使用 WXT 已安装的 esbuild 转译，`import.meta.glob` 从基线 Git 树展开原迁移注册表；浏览器存储、UI 资源、i18n 和日志使用测试适配。**外部 zod/definitions/api-contract 使用当前安装版本**，与基线原包依赖环境有差异，具体版本在 JSON 中披露。因此这是旧源码规则的校验，不是旧包执行证明。

## 具体断言

| 阶段         | 执行的真实接口与已验证结果                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 升级前备份   | 基线 `addBackup` 在目标迁移之前保存完整 schema100 config；检查备份时活动 config 的元数据仍为100，备份内容与输入相等。                                                                                            |
| 存储升级     | 目标 `initializeConfig()` 返回 `isFreshInstall:false`，写入 schema111；`lastModifiedAt:1000` 保持，未走损坏配置重置默认值路径。                                                                                  |
| 自有配置保留 | 自有 openai-compatible provider 的 id、model、baseURL、合成 apiKey 及原 provider id 列表保留；自定义动作 id、name、providerId、systemPrompt、prompt、output field id 保留。接纳目标的 layout/sample 等增量字段。 |
| 页面与输入   | `translationOnly`、16项/4000字符参数、输入的语言/cycle/450ms设置与 forward-written `translateTitle:false` 保留。false 是刻意放在 schema100 元数据下的前写入字段，未声称基线100默认具有该字段。                   |
| TG / Discord | config 中 bare-host 网站规则按 v101 正常转换为 `*.web.telegram.org` / `*.discord.com`；两个 tab 的独立 detectedCode、translationState 保持。这不涉及 DOM 草稿备份。                                              |
| 会员独立存储 | `local:forkConfig`、`local:forkSession`、`local:forkMembershipInfo` 在升级、当前导入和旧源码恢复后均保持。                                                                                                       |
| 当前版本导入 | 保存的 schema100 envelope 经过 JSON 序列化再解析，由目标 `migrateConfig` + `setLocalConfigAndMeta` 导入，得到111且保留上述配置。未执行导入按钮 UI。                                                              |
| 旧源码恢复   | 基线 `migrateConfig(config,111)` 以 `ConfigVersionTooNewError` 拒绝；先取已保存的100备份，再调用基线 `migrateConfig` 和 `setLocalConfigAndMeta`，落盘元数据回到100，并由基线 `configSchema` 接受。               |

旧 v100 schema 不认识 `translateTitle`，旧源码恢复时会正常剔除该未知字段；标题 false 的保留断言针对目标升级。旧备份保存原 bare-host 网站规则，所以恢复后规则回到旧 matcher 的原始表示。

## 运行命令

在仓库根目录运行：

```sh
SKIP_FREE_API=true node --import ./scripts/test-env.mjs ./node_modules/vitest/vitest.mjs run --config vitest.config.ts src/fork/__tests__/upstream-v151-migration.test.ts --reporter=default --reporter=json --outputFile=openspec/changes/upstream-sync-v1-51-0/evidence/config-migration/vitest-results.json
./node_modules/.bin/oxlint --type-aware --type-check src/fork/__tests__/upstream-v151-migration.test.ts
./node_modules/.bin/oxfmt --check src/fork/__tests__/upstream-v151-migration.test.ts src/fork/__tests__/fixtures/upstream-v146-config.json
```

fixture-only 的目标迁移测试不要求 Git 历史。其余四项要求基线 Git 对象可读；浅 clone 缺对象时会输出明确 stderr 原因并显示四项跳过，不能算完整验证。本次对象存在，五项全部执行。

## 浏览器仍缺的证据

- 使用已核实版本/hash 的旧包和独立 profile 先导出备份，再实际更新候选、重启 service worker / 扩展页，检查配置与 UI；当前 fixture 的新包导入/reload只能补“浏览器导入”证据，不能替代真实扩展升级。
- 候选中的 provider、动作、会员、输入设置及 TG/Discord 页面行为；真实登录/接口条件另列。
- 先恢复旧配置，再实际加载相同扩展身份的旧包，验证旧包启动与配置读取。旧包产物版本/hash、IndexedDB 数据版本兼容和真实回退效果尚未验证。

配置备份本来只包含上游 config；本测试证明独立会员/tab 键没有被这些函数清洗，不代表配置导出文件包含会员会话，也不证明卸载扩展后可以恢复这些键。
