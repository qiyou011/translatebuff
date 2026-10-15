# G4/G5 实包准入补证（有界子集）

最终运行：[2026-10-15T05-00-28.321Z/result.json](runs/2026-10-15T05-00-28.321Z/result.json)，结论 `PASS_BOUNDED_SUBSET`，10/10 case 通过。本证据不等于完整 G4/G5 验收，也不替代真实账号、会员权限、额度和网关验证。

## 产物与环境

- 源码候选：`5ac5122a6a4d390b3131f917dd09aa2caf5f5342`。
- 固定上游目标：`55bcef1e684fb4e70f4dce3063e7bd3066f46891`。
- 实际加载 `.output/chrome-mv3`，开始和结束 tree SHA256 均为 `2440c52300adfeed0fa087659a2a3dedbda2c614d0c2b7ba12f17654c1253906`；完整逐文件 SHA256 在运行结果 `identity.artifact.files`。
- Manifest SHA256：`113d6bd55a736bcf4b6013ee4f6acc71a4f8a97b92d6a91244eae993f8af0b56`，名称“任译喵 - AI 翻译与双语阅读”，MV3，`version=1.5.0`，`version_name=任译喵 1.5.0（rf 1.51.0）`。
- Headed Chrome for Testing `151.0.7922.34`，Playwright `1.62.1`，bundled Node 运行，每轮创建独立临时 owned profile。
- Profile、browser context、本地服务器均在 finally 清理；最终 `cleanup` 全部通过。未修改生产代码、产物、tasks 或 git 状态，未登录账号。

## 实际入口与结果

| Case                                           | 触发方式                                                                             | 实测结果                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `G5-serialize-system-nonretry`                 | 扩展 popup import 实包公共 provider-ref 模块                                         | 旧普通/高级 system provider 均抛出 `UPSTREAM_CLOUD_DISABLED`，`isRetryable=false`                                                        |
| `G5-video-cache-and-save-runtime`              | `chrome.runtime.sendMessage`，实际 `getCachedVideoSummary` / `saveVideoSummary` 协议 | cache 返回 `{res:null}`；save 返回明确错误、同上 code 和非重试元数据                                                                     |
| `G5-denied-default-sentence-analysis`          | 实际 `stream-structured-object` port                                                 | 句子分析直接调用只收到一条禁用 error，无 chunk/done                                                                                      |
| `G5-denied-default-improve-writing`            | 实际 `stream-structured-object` port                                                 | 润色直接调用只收到一条禁用 error，无 chunk/done                                                                                          |
| `G5-note-suggestion-runtime`                   | 实际 `stream-note-suggestion` port                                                   | 笔记建议只收到一条禁用 error                                                                                                             |
| `G5-old-system-stream-runtime`                 | 实际 `stream-text` port，合法 system 请求                                            | 明确禁用 error，迅速结束                                                                                                                 |
| `G5-old-system-generate-runtime`               | 实际 `backgroundGenerateText` 消息，合法 system 请求                                 | 明确错误 `UPSTREAM_CLOUD_DISABLED`，`isRetryable=false`                                                                                  |
| `G5-denied-action-with-working-local-provider` | 先存入有效本地 provider，再直接请求未批准动作                                        | 仍明确拒绝，本地 stub 收到 0 次该动作请求，不能借用可用 provider                                                                         |
| `G4-options-denied-deep-links`                 | 真实 options 页面，Drive / Notebase / 两个新动作共四个深链                           | Drive 和 Notebase section/连接控制均不存在；新动作编辑器不挂载，批准的词典保留；保存的两个新动作 `enabled=true` 仍保留，没有篡改用户配置 |
| `G5-normal-provider-positive`                  | 实际 `backgroundGenerateText` 消息，加真实 content 页翻译启动消息                    | localhost 正常 provider 收到 3 次请求，非流式调用返回译文，页面出现实际双语 DOM 译文及截图                                               |

消息 envelope 与 port start payload 均使用现有产品协议；最终原始 payload/response 在 `runtimeCalls`。port 协议本身只有 message/action/reason，不把它冒充成带 `isRetryable` 的原始异常；非重试属性由实际消息返回和真实模块调用分别验证。

唯一直接函数调用使用冻结包 `chunks/provider-ref-CBwYcnXp.js`，SHA256 `8ca3d7bfb85f225b906c0eb193c34ba18520490083e8a80d96c0edbd6febf1a9`。已读取完整实际模块，确认 `async function l(e,i)` 的本地/system 分支以及导出表 `l as t`，再从 popup 动态 import `t`；完整匹配源码和实际 `function.toString()` 保存在结果中。没有创建测试 helper 代替产品实现。

## 网络与正例边界

最终运行记录 Playwright 340 条请求、CDP 247 条请求，覆盖 service worker、extension page、具有 extension initiator 的 content script，另保留 page-or-unresolved；startup 至 browser 关闭前另有 Chromium Default netlog，脱敏 URL 事件在 [netlog-url-events.json](runs/2026-10-15T05-00-28.321Z/netlog-url-events.json)。原始 netlog 的 header/参数未保留，随 owned profile 删除。

未调用 route interception，也未拦截任何商业 API。按 harness 明示规则，观察到的上游商业 API、Drive API、OAuth2 API 请求均为 0；正常 localhost provider 请求为 3，证明请求采集和真实传输工作。禁止将此改述为“所有网络请求为零”。

新装扩展自动打开自有引导页，页面自身预取 `/login` 与验证码资源；CDP initiator 是自有网站脚本，runner 未点击登录、提交凭据或验证码。还观察到浏览器启动请求、自有报告/静态资源、图标资源及普通 Google MT 请求。这些全部保留，不将它们当作上游商业请求，也不据此声称真实账号服务已验收。零上游商业观察仅针对本轮运行的实际路径和已列规则。

## 截图、历史失败与未覆盖项

最终原始截图：`G4-drive-deep-link.png`、`G4-notebase-deep-link.png`、`G4-sentence-deep-link.png`、`G4-writing-deep-link.png`、`G5-provider-positive.png`，均位于最终运行目录。新动作深链的空编辑器占位呈窄列竖排；本轮只证明未挂载未批准编辑器，不判定其布局为通过，未修改产品样式。

历史运行完整保留：

- `04-57-44.979Z`：初版 runner 在 fresh-install config 尚未落盘时读配置，提前失败；改为 Node 端轮询真实 storage 后恢复。
- `04-57-54.362Z`：9/10 通过；非流式旧 system 测试误用 `modelTier=basic`，实际公共契约只允许 `normal/advance`，先返回 `Invalid hosted AI request`；按真实契约修正后复跑。
- `04-58-43.266Z`、`04-59-37.122Z`：10/10 通过；随后整理 runner 格式/类型 lint，并加强 save 和旧 system 非流式请求的非重试元数据断言，最终 `05-00-28.321Z` 再次 10/10 通过。

未覆盖：所有商业叶子功能的完整调用矩阵、X/Netflix 真实页面绕过、AI 转录真实媒体链路、学习侧栏全部入口、所有关闭设置的搜索入口、真实自有账号/权限/额度/网关服务、所有浏览器与打包渠道。没有凭据，未尝试登录。最终接纳与其余 G1—G7 结果由父任务整合。

复跑命令（必须保持同一冻结产物，runner 会校验 tree SHA256）：

```sh
/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node openspec/changes/upstream-sync-v1-51-0/evidence/admission-browser/admission-browser.mjs
```

`oxfmt --check`、`oxlint --type-aware --type-check` 和 `node --check` 结果见 [runner-validation.txt](runner-validation.txt)。
