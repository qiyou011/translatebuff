# juntao Chrome 实机验证记录

日期：2026-09-10。变更：`disable-upstream-cloud-services`。结论：本轮已执行项目通过；整体规格仍为部分验收，不能视为全部发布验收通过。

## 包体及安装身份

- 浏览器：用户现有 Google Chrome，个人资料 `juntao`。未另外启动测试实例；本轮未记录 Chrome 版本号。
- 当前源代码：基线 `cc6a6597` 加未提交云服务隔离与语言检测异常降级修复。
- 构建：`node scripts/pack.mjs test --edition cn` 成功，测试域名守卫通过；版本 1.3.0（rf 1.46.6）。
- 加载路径：`/Users/yisen/Desktop/Junyun/Projects/Company/translatebuff/.output/chrome-mv3`，已通过扩展详情页核对。
- ZIP SHA-256：`7c851601a5628b858781786ab76356f700774774a01adada8d85811680cd9da1`。
- background.js SHA-256：`1e471435400bc33882f3a691ac59555e211dd452874b4ab461e370a2d331d199`。
- 经用户确认，移除旧扩展 `jddidboonfbpeocbggfbmlfgacmcfboh`（原加载来源为下载目录），扩展列表确认旧项消失；加载新扩展 `jjgoechanghiknlblangmfijblhggkdl`。其他扩展未修改。
- macOS 选择器最终已进入正确目录，选择整个目录后安装成功；内部非目录文件显示灰色不代表安装包无效。

## 实际执行与结果

| 项目             | 实际结果                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 首次安装官网联动 | 自动打开测试官网 `/zh-hans/guide/step-1`，显示语言设置引导；未完成四步引导全流程                                                                                              |
| 会员与凭据恢复   | 设置页显示已登录 PRO，API Key 字段掩码显示，模型列表可用；未读取或导出凭据正文                                                                                                |
| 设置 UI          | API 提供商页正常挂载，功能模型行可用，无笔记建议行；正常会员菜单保留                                                                                                          |
| 普通网页翻译     | `https://example.com/` 标题、正文、链接出现中文双语结果；关闭翻译后恢复原文                                                                                                   |
| Discord 三空格   | 在既有 `elden-fun` 频道的空草稿输入“今天我们一起探索这个世界。”，三空格后得到 `Today, let's explore this world together.`，显示英语内联条                                     |
| 失焦与恢复       | 点击频道搜索框后内联条隐藏，重新聚焦消息框后恢复；草稿不变                                                                                                                    |
| 编辑译文后撤销   | 将整个译文替换为 `Edited draft with an added sentence.`，内联条保留；点击撤销后精确恢复最初中文原文                                                                           |
| 菜单搜索隔离     | 在语言搜索框输入 `Japanese`，焦点留在菜单且草稿不变；该查询显示无结果。改用界面语言名称“日语”后出现正确选项                                                                   |
| 切换语言         | 选择日语后得到 `今日は、一緒にこの世界を探検してみましょう。`，内联条显示“手动选择”                                                                                           |
| Esc              | 按 Esc 后内联条隐藏；未发送草稿                                                                                                                                               |
| 扩展重载         | 扩展管理页显示“已重新加载”；重新打开设置成功，会员和模型凭据仍可恢复                                                                                                          |
| 自有模型真实调用 | 临时将输入模型从 Google Translate 改为任译喵 `deepseek-v4-flash`；刷新 Discord 后翻译“今天的天气很好。”，得到 `The weather today is very nice.`；后台可见自有测试网关请求 200 |

Discord 地址：`https://discord.com/channels/867784605293084702/868146710772326482`。本轮所有文字均为自建测试草稿，没有发送聊天消息。结束时清空测试草稿、恢复输入模型为 Google Translate、关闭临时 DevTools，浏览器回到 Discord。

## 网络证据的覆盖边界

通过新扩展 Service Worker 的 DevTools Network 开始记录，开启 Keep log 后执行扩展重载、设置页重新打开及一次自有模型输入翻译。结束时共记录 60 条请求：

- `https://cbs1sit.htjsq.com/api/claw_bff/v1/tokens`：GET 200。
- `https://oneapi-test.6fast.com/v1/chat/completions`：POST 200。
- 使用正则 `/\/api\/(identity|rpc|blog)/` 筛选，显示 **0 / 60 requests**。
- 仍可见图标资源和 PostHog 请求，它们不属于本次要求禁用的三个 API；本轮未扩大屏蔽范围。

上述为真实后台观察窗口证据，不是首次安装前就开始的全程抓包，也不是扩展页面和所有内容脚本网络的完整证明。未导出 HAR、Cookie、token 或 API key。原始可访问性状态和截图保留在本任务工具记录中。

## 待定位日志及未覆盖项目

- 新扩展出现两条 `Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.`，上下文显示未知。发生在安装/重载观察期间，但没有证据证明具体来源或是本次新增回归；页面及输入翻译实际成功也不能代替该日志的根因定位。保留待查，不标为无错误。
- 语言菜单英文查询 `Japanese` 未匹配中文界面中的“日语 (日本語)”；中文名称可搜索。仅记录现象，未判定为本次变更新缺陷。
- 尚未覆盖：海外测试包；旧 system 配置升级、无合格候选及候选顺序的真实浏览器场景；划词、字幕、自定义动作/词典、朗读完整回归；语言配置读取异常的真实浏览器故障注入；未登录/凭据过期/额度不足/登出；全上下文冷启动、会话变化和旧笔记任务零请求。
- 这些项目不以之前的单元测试或本轮局部成功替代；OpenSpec 未完成任务仍保持未勾选。
