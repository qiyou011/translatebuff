# G6 真实旧包升级与回退验证

最终结果：**PASS，7/7 阶段通过**。真实旧包来自主仓保留的 `4be99b341a7c940a48794232f066db43339cc2d2` 源码，在临时目录独立构建；真实候选包为 `5ac5122a6a4d390b3131f917dd09aa2caf5f5342`，上游目标为 `55bcef1e684fb4e70f4dce3063e7bd3066f46891`。此证据替代此前“尚未执行实际旧包回退”的覆盖缺口，不把旧源码 validator 单测当作旧包验收。

最终报告：[report.json](rollback-runs/2026-10-15T05-02-08.747Z/report.json)。检查结果：[rollback-checks.json](rollback-checks.json)。

## 实际产物与隔离范围

| 项目                             | 旧包                                                               | 候选包                                                             |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 业务 manifest.version            | 1.5.0                                                              | 1.5.0                                                              |
| version_name                     | 任译喵 1.5.0（rf 1.46.6）                                          | 任译喵 1.5.0（rf 1.51.0）                                          |
| 产物 tree SHA256                 | `c1e9ecc8dd3900a7db0fd5c679eae66fd79e8c28b8590fdcccf68f3bbbf8140c` | `2440c52300adfeed0fa087659a2a3dedbda2c614d0c2b7ba12f17654c1253906` |
| manifest SHA256                  | `aaeb2df3514aebe260125e258dd58f1d57c846e9f04ef2d003e15f32dc6e2bcf` | `113d6bd55a736bcf4b6013ee4f6acc71a4f8a97b92d6a91244eae993f8af0b56` |
| 实际 worker background.js SHA256 | `0b68603c805ac1a1f322047e7e3a8221565a3633b2f6d84415f445e5830de9d3` | `4a3ac86a5c77564aa4f5740eda9046e5e669f7d1113e554bbfddbcdf0193bd77` |

浏览器为 Chrome for Testing `151.0.7922.34`，8 次完整冷启动，统一 viewport `1440×1000`。仅使用自建全新 profile；两个原始产物复制到同一临时固定扩展目录，在浏览器完全关闭时替换目录内容，保证 extensionId 不变。未修改候选 `.output`、主仓 tracked source 或主仓 node_modules，未使用真实账户、cookie 或会员 token。最终关闭 context/本地服务并删除本次 profile 与完整快照。

主仓旧依赖使用 APFS 私有副本：`@read-frog/api-contract 0.14.0`、`@read-frog/definitions 0.4.4`、`zod 4.4.3`、`wxt 0.21.4`、`ai 7.0.66`、`@ai-sdk/openai 4.0.42`；构建日志 Vite `8.2.1`。旧安装树缺少旧 package.json/pnpm-lock 已声明的 `@fontsource-variable/onest 5.3.1`，首次构建失败。仅在临时依赖树下载该精确版本并校验旧锁 SRI 后重建成功，未用候选依赖替换旧依赖。详见 [rollback-build-preflight.json](rollback-build-preflight.json)、[首次日志](rollback-build.txt)、[补齐后日志](rollback-build-resumed.txt)。

构建未复制 `.env`，只显式注入 localhost 公共地址。源文件摘要覆盖 1940 个文件，构建前后及最终复核未变化。旧源码 SHA 绑定依据为主仓 plain ref 文件和父任务确认的未改动 checkout；本任务未执行 Git 命令。

## 实际执行链路与断言

1. 安装真实旧包，写入来自 schema100 fixture 的匿名配置与实际 helper 推导的 `config$` 元数据，然后旧包完整冷启动。旧后台接受 schema100，保留用户 provider、custom action、`translationOnly`、TG/Discord 模式配置及无 token 独立 storage 标记。旧 schema 没有 `translateTitle` 字段；本场景不伪造旧字段。
2. 在旧包真实 options 的 `Backup now` 按钮创建 schema100 备份。保存实际 storage 备份正文和 metadata。通过真实 `enqueueTranslateRequest` 调用受控 localhost OpenAI-compatible 服务，得到“回退验证成功”；重复请求不再访问服务。实际 `TranslateBuffDB` native version 为 40，四个旧表。
3. 完全关闭浏览器后复制整个 owned profile。快照前后文件树 SHA 一致；快照包含 config/storage 和 IndexedDB。
4. 将同一路径替换为候选产物。显式 `Extensions.loadUnpacked` 注册、完整冷启后，实际候选后台执行 schema100→111，保留原100备份与上述设置，标题109迁移默认 true。实际数据库 native version 为60，新增 `glossary`、`glossaryTerm`、`glossarySyncSnapshot`；候选真实受控翻译与重复缓存通过，旧包先前缓存仍命中且新增网络调用为0。
5. 读取第2步实际备份，手动恢复其 config 正文和捕获的 schema100 metadata；这是明确的原始配置恢复。候选 options 导入会向111迁移，因此不能用候选 UI 导入声称降到100。
6. 显式注册回真实旧包后，重新应用同一实际100备份和 metadata，再完整冷启动，保证最终验收执行的确为旧源码。**只恢复配置的实际旧包回退 PASS**：旧后台可翻译和缓存，仍保持 native60 及全部新增表；升级前旧缓存和候选新缓存均能命中。没有删除数据库或清空缓存；未出现 VersionError。
7. 完全关闭浏览器，恢复第3步完整 profile 快照，使用同一旧包冷启动。**完整快照回退 PASS**：config100、原100备份、旧 native40 数据库和旧缓存都在，候选阶段/直接降级阶段新增缓存不在；旧包真实翻译、重复缓存、options 备份页可用。这条路径会丢弃所有升级后新增数据，新术语等需另外导出后再回退。

真实模型仅为本机受控 HTTP fixture；4 个阶段各实际访问一次，重复和跨包缓存复用均无额外调用。观察到92次浏览器 HTTP(S) 请求尝试，未观察到远端付费 LLM endpoint 请求；BrowserContext events 不等于全 target CDP 网络审计，不声明完全离线或零网络。

## 加载故障与历史报告

同 manifest 业务版本的 unpacked 目录替换后，仅冷启动不足以证明后台已更新。最终运行的实际 CDP `Debugger.getScriptSource` 证明：候选 manifest 已改变时，旧 worker 源 hash 仍可能被缓存。用 `--enable-unsafe-extension-debugging` 启动后调用 `Extensions.loadUnpacked({path})`，返回相同 extensionId，再完整冷启，实际执行源码 hash 才与当前磁盘包一致。降级也做相同核对；没有改 manifest 版本或包内容。

[首轮报告](rollback-runs/2026-10-15T04-58-48.017Z/report.json)保留加载超时，不能当作候选迁移代码失败。[中间运行](rollback-runs/2026-10-15T05-00-47.773Z/report.json)七阶段实际全部 PASS，但 runner 顶层 status 当时硬编码错误地写作 `PASS_WITH_CONFIG_ONLY_ROLLBACK_FAILURE`，原始记录保留；最终 runner 修复聚合，并增强了不清缓存的存续断言，最终新运行是上方 `05-02-08.747Z`。

## 原始 UI 截图

均来自最终运行，无拼接或重绘；同 viewport、匿名状态。

- [旧包 popup](rollback-runs/2026-10-15T05-02-08.747Z/01-old-anonymous-popup.png)
- [候选 popup](rollback-runs/2026-10-15T05-02-08.747Z/03-new-anonymous-popup.png)
- [旧包实际100备份](rollback-runs/2026-10-15T05-02-08.747Z/02-old-real-schema100-backup.png)
- [候选保留旧备份](rollback-runs/2026-10-15T05-02-08.747Z/04-new-keeps-actual-old-backup.png)
- [直接回退旧 popup](rollback-runs/2026-10-15T05-02-08.747Z/05-direct-downgrade-old-popup.png)
- [完整快照恢复旧 popup](rollback-runs/2026-10-15T05-02-08.747Z/06-full-profile-restore-old-popup.png)
- [完整快照恢复旧 options](rollback-runs/2026-10-15T05-02-08.747Z/07-full-profile-restore-old-options.png)

## 复核命令与边界

```sh
node openspec/changes/upstream-sync-v1-51-0/evidence/config-migration/rollback-build.mjs
node openspec/changes/upstream-sync-v1-51-0/evidence/config-migration/rollback-build-resume.mjs
node openspec/changes/upstream-sync-v1-51-0/evidence/config-migration/rollback-browser.mjs
node openspec/changes/upstream-sync-v1-51-0/evidence/config-migration/rollback-verify.mjs
```

最后一个脚本保存 `node --check`、`pnpm run type-check <五个mjs>`（oxlint `--type-aware --type-check`）、oxfmt 格式检查，全部 exit0。原 browser-migration.mjs 的 cleanup 仅将 `await close().catch(...)` 改为等价 `try { await close() } catch`，保留真实异步清理，未重新解释历史浏览器证据。

本次证明实际构建旧包与候选之间的 unpacked 加载、配置迁移、配置备份恢复、旧/新 IndexedDB 兼容及匿名旧包可用。仍未覆盖商店签名 CRX 升/降级、真实会员登录/付费服务、已有真实用户数据全集、TG/Discord 站点交互、其他浏览器，以及新术语内容的跨版本导出/重新导入。完整快照恢复对新增术语的丢弃属于明确恢复点语义，不能宣传为无损合并回退。
