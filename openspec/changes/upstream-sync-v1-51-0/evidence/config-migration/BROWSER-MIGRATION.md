# schema100 → 111：真实候选浏览器验证

**迁移、设置页导入、备份恢复、再次启动：5 个阶段全部 PASS。** 本证据补充同目录的源码单测证据；它仍不等于“真实旧包安装后升级”或“旧包回退成功”。

运行目录：`browser-runs/2026-10-15T04-41-40.235Z/`。`report.json` 保存实际读取的 config/meta 投影、操作顺序、backup id、浏览器与产物身份；`runner-output.txt` 保存本次退出码为0的运行输出，`runner-checks.json` 保存 runner 的语法、oxlint 和格式检查结果。

## 身份

- 候选：`5ac5122a6a4d390b3131f917dd09aa2caf5f5342`；固定上游 `55bcef1e684fb4e70f4dce3063e7bd3066f46891`。
- 产物：`.output/chrome-mv3`，manifest `1.5.0`，version name `任译喵 1.5.0（rf 1.51.0）`。
- CFT：`151.0.7922.34`，真实 MV3 worker，独立新 profile。
- manifest SHA256：`113d6bd55a736bcf4b6013ee4f6acc71a4f8a97b92d6a91244eae993f8af0b56`。
- 产物树 SHA256：`2440c52300adfeed0fa087659a2a3dedbda2c614d0c2b7ba12f17654c1253906`，运行前后相同。逐文件 hash 在报告中。
- WXT 元数据键从实际安装的 `@wxt-dev/storage` 的 `getMetaKey(driverKey)` 读取规则生成，实际键为 `config$`；没有猜测或使用 `configSchemaVersion`。

## 实际顺序与断言

| 顺序 | 操作与实测结果                                                                                                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 先启动候选至正常初始化，再在该独立 profile 的真实 `chrome.storage.local` 写入 schema100 fixture、`config$` 元数据、schema100 备份及其索引/metadata。写后立即读取，确认活动 schema100 和原备份均实际存在。                                                                   |
| 2    | 关闭整个测试浏览器，保留同一 profile，以相同 unpacked 包冷启动。真实后台 `initializeConfig` 将 `config$.schemaVersion` 从100写到111，原 `lastModifiedAt` 保持。原 schema100 备份仍完整。                                                                                    |
| 3    | 读取并断言自有 localhost provider 的 id/model/baseURL/空 key、全部旧 provider id、自定义动作 id/provider/prompt/field id、`translationOnly`、`translateTitle:false`、16/4000参数、输入语言/cycle/450ms设置保留。TG/Discord 网站模式按目标迁移正常转成 `*.host`。            |
| 4    | 在真实 options Preferences 页面，通过 `#import-config-file` 上传保存的 schema100 envelope。上传前将当前模式/title改成 bilingual/true作为对照，导入后回到 translationOnly/false及schema111；实际观察到 `Config imported successfully`，产品自动创建 schema111 当前配置备份。 |
| 5    | 进入真实 Config backup 页面，定位 `Schema version:100` 的备份卡片，点击 Restore 和确认弹窗的 Restore。操作前再次改成 bilingual/true，操作后实际读回 translationOnly/false及111，观察到 `Config restored successfully`。                                                     |
| 6    | 再次关闭并以同一 profile 冷启动。真实后台仍读取111、上述配置及100备份保留，设置页正常渲染；整个运行没有 pageerror。                                                                                                                                                         |

两次重启都明确记录为 `full-browser-cold-relaunch-same-owned-profile`。本 runner 没有执行 `runtime.reload`，也未据此宣称其成功；这是针对根任务已观察的 CFT `ERR_BLOCKED_BY_CLIENT` 限制采用的浏览器/SW 冷重启验证。

保存的100备份是**显式种入的“已存在备份”fixture**，metadata版本显示 `fixture-from-4be99b34`；没有伪造旧包版本，也没有声称观察到旧包自动备份。fixture基于同目录单测使用的冻结100配置构造，所有 apiKey 已清空；增加的自有 provider 指向 `http://127.0.0.1:9/v1`，未触发翻译请求。

## 原始 UI 截图

- `01-after-upgrade-preferences.png`：升级后的自有设置页。
- `02-import-success.png`：真实导入成功 toast。
- `03-schema100-backup-visible.png`：100备份卡片可见。
- `04-restore-confirmation.png`：真实恢复确认弹窗。
- `05-restore-success.png`：真实恢复成功 toast。
- `06-after-second-reload.png`：再次冷启动后的设置页，同时显示100及111备份。

这些截图均为 Playwright 原始截图，未拼接、未绘制状态替代实际 UI；已目视核对导入成功和二次启动截图。

## 隔离、清理与边界

未读取用户现有 Chrome/profile/账户/cookie，未种入会员 token 或登录会话。仅检查真实 `forkConfig` free 设置与无 token 的 `migrationIsolationMarker` 独立键在迁移、导入、恢复、重启后保持；登录会员态保留仍待真实账户验收。

浏览器配置了 DNS resolver rules，但本 runner 只记录 BrowserContext 的 request 事件，没有验证 response，也不是完整 CDP/SW 网络审计。共观察到90个请求尝试，包含启动统计、Google新装免费探测、引导页与图标等；不能声称“零网络”或据此判定请求成功完成。观测中 localhost 受控 provider 请求为0，付费 LLM endpoint 请求为0。迁移 PASS 不承担商业网络隔离的验收结论。

本次共3次创建浏览器 context，始终使用本任务自己的同一临时 profile；finally 已关闭 context、删除 profile，产物未变化。没有改动生产源码或测试。

仍未覆盖：真实旧包安装→候选更新、旧包版本/产物hash和旧包回退、旧版本 IndexedDB 兼容、登录会员/真实provider服务、TG/Discord编辑器草稿与撤销等实际行为。候选中的实际100存储迁移、导入/恢复 UI 与持久状态再启动已具备浏览器证据。

## 复现

```sh
node openspec/changes/upstream-sync-v1-51-0/evidence/config-migration/browser-migration.mjs
```

runner 固定核验候选 SHA，每次创建新的独立 profile，运行后自动清理；需要本机 CFT151 与任务指定的 Playwright runtime。输出会创建新的 `browser-runs/<UTC时间>/` 目录，不复用用户 profile。
