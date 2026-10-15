# 选择工具栏设置页云功能挂载回归

2026-10-15，用户确认 Switch 实际显示正常后，点击“悬浮工具 → 选择工具栏”进入应用恢复页，报 `Upstream cloud services are disabled. Sign in to TranslateBuff or select an available model.`。

状态：**源码修复、真实组件集成回归、工程检查及独立审查完成，新海外包已更新原下载目录；用户已重载并确认实际设置页“恢复正常”。** 本轮未访问被浏览器策略禁止的扩展内部页面，也未修改用户配置。

## 根因与修复

`/selection-toolbar` → fork `SelectionToolbarPage` → 共享 `ActionsSection` → 无条件挂载 `NoteSuggestionItems` → 在渲染期调用 fork `resolveNoteSuggestionAction`。该 resolver 按已批准的准入策略直接抛 `UpstreamCloudDisabledError`，最终进入整个应用 ErrorBoundary。错误发生在 `useFeatureProvider("noteSuggestion")` 之前，不是登录失败或远程请求失败；该配置关闭也会触发。

本次新增一个既有形式的空叶子重定向：

- 原源：`src/entrypoints/options/pages/selection-toolbar/actions/note-suggestion-items.tsx`。
- fork目标：`src/fork/ui/options/note-suggestion-items.tsx`，仅返回null，不挂载未准入的笔记建议设置。
- `wxt.config.ts` 注册该映射；原文件逐行审阅后，仅在 `redirect-baseline.json` 新增其指纹 `8d2e9b2e21b01185`，现有条目均保留。映射总数58→59。

翻译、朗读、透明度、网站排除仍复用共享真实组件。未修改 resolver、transport、默认配置或旧配置，也未开启上游商业能力。此前布局和 Switch 修复保留。

图影响原文保留在本目录：NoteSuggestionItems 为 LOW、1个直接调用（ActionsSection）、3项上游影响。注册常量的图结果为LOW/0，不能视为没有影响；插件函数补图同为LOW，源码另确认生产WXT和fork Vitest共用表，生产注册边未被图捕获。

## 复现与验证

新增 `src/fork/ui/options/__tests__/selection-toolbar-page.forktest.tsx`，直接渲染实际fork Page、ActionsSection、配置atoms与控件；只替换存储边界，不替换触发错误的 resolver 或相关组件。

| 验证                                           | 结果                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 修复前，保存 noteSuggestion false / true       | 两例均进入错误边界，精确复现截图错误，RED 2失败                                              |
| 修复后同两种配置                               | 页面正常，未准入入口不挂载，显示设置保留，翻译开关修改并持久化，旧 noteSuggestion 值不被改写 |
| 相关页面／执行准入／ORPC拒绝                   | 10项通过；独立审查另跑12项通过                                                               |
| 独立反向验证                                   | 在内存恢复原叶子后两例再RED；恢复当前接线后页面与直接resolver检查4项通过                     |
| 主套件                                         | 4998通过，4个外部在线测试按 `SKIP_FREE_API=true` 有意跳过                                    |
| fork套件                                       | 901通过                                                                                      |
| 本次代码单独类型／lint                         | 通过；曾发现测试querySelector返回Element类型不符，已用HTMLElement类型参数修正                |
| 全仓类型／lint                                 | 仍有旧浏览器脚本5项及dev-local测试3项现有诊断，不记为全仓绿                                  |
| 固定目标boundary、brand、格式、OpenSpec strict | 通过，日志保留                                                                               |
| 独立审查                                       | 审查通过；相邻悬浮按钮、提供商设置未发现同类遗漏                                             |

上述是源码／jsdom集成和打包证据，不等同真实扩展内部页浏览器通过，也不作为完整G5零商业请求证据。既有测试只覆盖右键菜单示意页与其他云入口，没有覆盖这个真实Page完整挂载；新测试补上了该缺口。

## 新候选包

- 构建目录 `.output/selection-settings-fix/chrome-mv3-global`，208文件。
- tree SHA256：`105f3874cdca052d34eb5eed1576a201112f36e7e772aaabb67999f20683b9ac`。
- manifest 与上一包相同；构建JavaScript中14个WXT环境字符串的逐值哈希集合完全相同，密钥值未写入证据。
- 打包分块和压缩会受依赖变化影响，去除文件名哈希后仍有50份旧／51份新JS差异；清单保留在 `artifact.json`，本轮不声称JS字节等价。
- 原 `.output/chrome-mv3-global`、布局构建、Switch构建均未覆盖。原下载目录保持 `/Users/yisen/Downloads/TranslateBuff-Global-1.5.0-rf1.51.0-20261015`，校验后原子替换；上一407fbe95包完整备份，路径见 `artifact.json`。没有访问或写入Chrome profile／用户设置。

实际内部页受浏览器工具URL安全策略限制，用户已在重载后确认“设置页恢复正常”，实际页面恢复记为人工验收通过。H01、H02、Reddit、Telegram继续暂缓，其余剩余验收状态保留；未提交、push、发布或推进1.46.6已接纳基线。
