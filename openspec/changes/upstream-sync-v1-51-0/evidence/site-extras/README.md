# P02 / P06 独立受控浏览器证据

最终运行：`runs/2026-10-15T04-53-10.042Z/result.json`，两项 **PASS（受控站点 fixture 范围）**。5 张截图均为 Playwright 对真实浏览器的原始视口截图，未拼接、未编辑。

- 冻结源码：`5ac5122a6a4d390b3131f917dd09aa2caf5f5342`；固定上游：`55bcef1e684fb4e70f4dce3063e7bd3066f46891`。
- 浏览器：Chrome for Testing `151.0.7922.34`；Playwright `1.62.1`；真实 unpacked MV3 扩展 `1.5.0 / rf 1.51.0`。
- 产物：`.output/chrome-mv3`，国内 production；父任务构建日志 `/tmp/translatebuff-sync-build-cn-final.log` 明确 `Building chrome-mv3 for production`，父任务另已通过 cn `assert-fork-build`。
- 产物树 SHA256：`2440c52300adfeed0fa087659a2a3dedbda2c614d0c2b7ba12f17654c1253906`；运行前后相同。结果包含逐文件 SHA256、manifest SHA256 和 runner SHA256。
- 使用全新独立 profile，无真实账户；保留 6 个默认 provider，追加一个符合构建 schema 的 `renyimiao-` / `openai-compatible` localhost provider。真实后台发出的 11 次受控模型请求由本地 HTTP 服务接收。没有调用付费真实模型。
- 浏览器、服务器和临时 profile 均已清理；没有生产源码变更，没有 stage 或 commit。

## 覆盖与结果

| 项目                   | 实际路径与证据                                                                                                                                                                                        | 结果                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P02 长页显式 AI 动作   | `https://en.wikipedia.org/wiki/Controlled_context_article` 以 `route.fulfill` 提供 681431 字符正文、1802 段、36 个表 / 35 个嵌套表；真实划词工具栏点击自定义动作，真实后台及 provider 捕获最终 prompt | `webContent` 恰为 2000 字符，包含嵌套表 canary，尾部文章不进入 prompt；`webTitle` 为源标题；`{{webContent}}` 已真实解析                                      |
| P02 转换前约束与表处理 | 仅在扩展 ISOLATED world 包装原生方法做计数和耗时观测，保留 `.apply(this, args)` 原行为                                                                                                                | Defuddle 输出解析中仍有 36 表 / 35 嵌套表；实际展平 35 表；Markdown 输入只剩 1 表 / 0 嵌套表，3471 HTML 字符 / 2182 文本字符，远小于原文                     |
| P02 响应与缓存         | 首次动作点击到 provider 157ms，点击到结果可见 212ms；再次 53ms。真实页面翻译写入源/译标题，再执行同页锚点跳转并重开真实动作                                                                           | 两次最终 `webContent` 完全相同、均 2000 字符，源标题不变。snapshot 次数为首次划词 1、host 初次激活后 2、锚点再次动作后仍 2，没有额外 selection 解析          |
| P06 Google 引用卡      | `https://www.google.com/search?q=controlled-citation` 以 `route.fulfill` 提供精确 `[role=dialog][data-skip-highlighting]` 引用卡；真实 host 引擎翻译并通过 adoptedStyleSheets 注入内置 Google 规则    | 原文 clamp=2 / max-height=54px，译后 clamp=none / max-height=none，段落高度 880px；内层 overflow-y=auto，clientHeight=270 / scrollHeight=900 / scrollTop=630 |
| P06 译文末尾与外部容器 | 卡片内真实滚动到尾部，Range 测量最终字符                                                                                                                                                              | 末尾标记屏幕坐标 y=458.5–483.5，位于内层容器 y=231.5–503.5 及视口内；外部对照容器的高度、max-height、overflow 不变                                           |

## 接受边界

- 这是固定产物在受控真实浏览器里的执行证据，不代表 Google 个性化 AI Overview 线上回包、Wikipedia 线上内容、Edge、真实模型质量或付费账户验收。
- P02 Markdown 前按完整文本节点边界约束，观察到 2182 字符；最终 `webContent` 精确截为 2000。本证据不声称 Markdown 前已经逐字符精确 2000。前期单列表 fixture 被 Defuddle 自行展开时观察到 2083 字符；最终 fixture 加真实表头以覆盖目标展平代码。
- 自定义动作公开 token 支持 `webTitle/webUrl/webContent/paragraphs`，没有 `webDescription` token。因此最终请求未伪造 description 字段；fixture 的 description 只作为源页面元信息记录。
- 只用真实 host 标题翻译写入 `__READ_FROG_TRANSLATED_DOCUMENT_TITLE__`；脚本不 seed 或伪造该缓存字段。
- 全程没有 `route.abort` 或外部域名封锁。240 条运行中网络记录只保存去 query/fragment 的 URL、方法和上下文，不保存 headers/keys。listener 在浏览器启动后立即接入，因此不是完整启动 netlog，也不单独构成全部商业隔离结论；`page-or-content-script-unresolved` 明确保留归因不确定性。
- `runs/2026-10-15T04-50-21.063Z`、`04-51-04.478Z`、`04-51-52.580Z` 保留脚本开发期原始失败证据：分别涉及 Markdown 下划线转义 / adoptedStyleSheets 观察、Defuddle 单列布局表展平、将 host 初次激活解析误算为 selection 缓存失效。最终通过结果以 `04-53-10.042Z` 为准。

## 运行与校验

工作目录：`/Users/yisen/.codex/worktrees/upstream-sync-v1-51-0/translatebuff`。

```sh
node --check openspec/changes/upstream-sync-v1-51-0/evidence/site-extras/site-extras.mjs
node_modules/.bin/oxfmt --check openspec/changes/upstream-sync-v1-51-0/evidence/site-extras/site-extras.mjs
node_modules/.bin/oxlint --type-aware --type-check openspec/changes/upstream-sync-v1-51-0/evidence/site-extras/site-extras.mjs
node openspec/changes/upstream-sync-v1-51-0/evidence/site-extras/site-extras.mjs
```

上述语法、格式和类型感知检查均 exit 0；最终独立浏览器 runner exit 0，P02 / P06 均 PASS，page/provider errors 为空。未运行单元测试：本次仅新增独立取证脚本，生产源码冻结。

原始截图：

- `runs/2026-10-15T04-53-10.042Z/P02-first-explicit-ai-action.png`
- `runs/2026-10-15T04-53-10.042Z/P02-real-title-anchor-context-cache.png`
- `runs/2026-10-15T04-53-10.042Z/P06-card-original.png`
- `runs/2026-10-15T04-53-10.042Z/P06-card-long-translation-top.png`
- `runs/2026-10-15T04-53-10.042Z/P06-card-long-translation-bottom.png`
