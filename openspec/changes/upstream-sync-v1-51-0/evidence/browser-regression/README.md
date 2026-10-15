# v1.51.0 浏览器回归脚本

这里只保存脚本与运行证据，不修改扩展源码、配置 schema、tasks 或 package。运行由主线程统一安排；须等待主线程完成候选包构建并冻结产物。语法检查和 `--list` 不能算浏览器验收。既有运行结果按各自实际 `result.json` 判定，脚本修复不追改历史结果。

脚本以新建临时 profile 启动 **headed Chrome for Testing**，加载 `EXTENSION_PATH` 指定的真实 MV3 包。它等待首次安装生成完整 config，再修改当前 `config.pageTranslation`，使用实际 `tryToSetEnablePageTranslationByTabId` 消息并按 `@webext-core/messaging` 约定解包 `{res,err}`。Provider 仅指向自建本地 OpenAI 兼容服务，不使用账号或真实收费 key；本地响应是可识别的 `受控译文`，证明真实执行与 prompt 传输，不证明翻译质量。

受控 provider 使用目标 `buildRenyimiaoProvider` 相同的 schema / `renyimiao-` 可见身份前缀，传输地址仍严格为 localhost。这是测试身份 stub，不是实际任译喵账号/权益或真实网关验收。这样不会触发现有 popup/options 将隐藏的任意 LLM 选择重指向任译喵的 UI 同步规则。默认 providers 保留，避免即使关闭的 noteSuggestion 等默认 provider 引用失效。每次补丁和新建 fixture 后，从实际构建的共享 chunk 找到 `configSchema` 并执行 `safeParse`；`configValidations` 记录通过状态和脱敏 issue，失败立即结束或记录 FAIL。只读回 storage 不算配置合格。

## 执行

在本工作树根目录运行；本机已发现的 Node / Playwright 默认值也可通过环境变量替换。运行时不安装依赖、不改系统浏览器或现有 profile。

```bash
NODE=/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
SCRIPT=openspec/changes/upstream-sync-v1-51-0/evidence/browser-regression/browser-regression.mjs
"$NODE" "$SCRIPT" --list
"$NODE" "$SCRIPT" --preflight
BUILD_EDITION=cn BUILD_ENVIRONMENT=production TEST_STAGES=core,glossary,isolation "$NODE" "$SCRIPT"
```

完整受控子集可分阶段重跑；每次都是新的 profile，与上次独立。

```bash
TEST_STAGES=privacy "$NODE" "$SCRIPT"
TEST_STAGES=iframe "$NODE" "$SCRIPT"
TEST_STAGES=sites "$NODE" "$SCRIPT"
```

真实框架补充 runner 独立运行，不复用主 harness 的浏览器实例：

```bash
FRAMEWORK_SCRIPT=openspec/changes/upstream-sync-v1-51-0/evidence/browser-regression/frameworks.mjs
"$NODE" "$FRAMEWORK_SCRIPT" --bundle-check
BUILD_EDITION=cn BUILD_ENVIRONMENT=production FRAMEWORK_CASES=react,lexical "$NODE" "$FRAMEWORK_SCRIPT"
```

`--bundle-check` 只把本机 React/ReactDOM 19.3.0 与 Lexical 0.52.0 用 WXT 内 esbuild 打包到自建临时目录，记录依赖版本、package hash、bundle hash 与实际库输入清单，随后清理，不启动浏览器、不把约 1.85 MB bundle 存入 Git。正常运行在 `framework-runs/<UTC时间>/` 保存 JSON 与截图，可用 `FRAMEWORK_EVIDENCE_DIR` 改路径、`FRAMEWORK_CASES=react` 或 `lexical` 单独运行，`ESBUILD_MODULE` 可覆盖构建器路径。覆盖范围以实际断言与结果为准。

React 19.3 会跳过完全相同 `__html` 字符串的赋值，所以 fixture 在原文 P 上改变惰性的 `data-html-revision`，确保 React 真正执行 `innerHTML` 并替换 P，同时保持 carry 判定相关的文字与标签结构不变。runner 仍要求 P 实例真的变化、已完成 wrapper 为同一节点、HTTP 请求不增加；结构变化不能复用，pending 的旧 spinner 必须断开。此方法不是通过普通 DOM 手工改写冒充 React。

框架 runner 在 React mount 后等待顶层 `refreshDetectedPageLanguage` 现有消息处理器实际应答；该处理器在页面 manager 开关监听之后注册，因此 React fixture ready 不会被误当成扩展 ready。仅应答探测允许重试，开启翻译只发送一次，随后只读等待后台实际启用状态，并核验 storage 内仍是 schema 校验后的受控 provider。`hostReadiness`、`runtimeCalls`、`runtimeSnapshots` 和页面 console 记录保留探测次数、运行时返回、无 key 的配置摘要及失败现场。旧的首次断言失败和初始超时 raw 目录保留；任何等待失败继续记 FAIL，不用反复开启来掩盖启动问题。

可覆盖的环境变量：

| 变量                                  | 默认 / 用途                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `TEST_REPO`                           | 从脚本位置推导本工作树根目录                                                                                   |
| `EXTENSION_PATH`                      | `$TEST_REPO/.output/chrome-mv3`；可指向已冻结的其它国内/海外 Chromium 包                                       |
| `PLAYWRIGHT_MODULE`                   | `/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs` |
| `BROWSER_EXECUTABLE`                  | `chromium.executablePath()`；可传 Edge 的已发现可执行路径                                                      |
| `TEST_STAGES`                         | `core,glossary,isolation`                                                                                      |
| `BROWSER_EVIDENCE_DIR`                | 本目录 `runs/<UTC时间>/`；每次应使用独立目录                                                                   |
| `BUILD_EDITION` / `BUILD_ENVIRONMENT` | 必须由构建者标明，如 `cn` / `production`，未传时明确记录 `UNSPECIFIED`                                         |
| `UPSTREAM_HOSTS`                      | 可补充本次构建对应的上游预览域名，逗号分隔，仅影响报告分类，不拦截网络                                         |

## 证据和判定

`result.json` 包含候选 HEAD、dirty 状态、固定目标 SHA、manifest 版本与 hash、完整产物逐文件 hash 与汇总 hash、浏览器版本、扩展 ID、实际 SW URL、原始截图路径、用例结果及 15 项逐项覆盖状态。`partial-result.json` 在每个用例开始/结束、schema 校验及收到受控 provider 请求时刷新；控制台即时打印 FAIL 原因，失败截图绑定当前 fixture/options 页并保存 DOM 摘要。退出码 0 只表示所选受控用例没有断言失败；`CONTROLLED_SUBSET_PASS` 和 `OBSERVED_ZERO_WITH_LIMITED_SCENARIOS` 都不等于完整 G3/G5 验收通过。G5 场景断言失败时会明确记为 `INCOMPLETE_SCENARIO_FAILURE`，不能凭净日志零请求改称场景通过。产物运行期间变化会失败；dirty 候选 HEAD 也不能独自充当已提交候选身份。

网络取证不通过 route 屏蔽商业请求来制造零：全 context Playwright request 记录区分 SW、扩展页与普通页；页面 CDP 记录 initiator，存在扩展脚本堆栈时标明 content-script。SW 另开 CDP session 记录请求。Chrome `Default` netlog 覆盖 Playwright 启动返回前的窗口，结束时只提取去掉查询参数的 URL / source type，原始 netlog 随自建临时 profile 删除。证据不保存 request headers、Authorization、Cookie 或 key。缺 initiator 的请求保留 unresolved；netlog 没有可靠执行上下文，不能补足分上下文归因。收集覆盖缺口会明确记录，不将“没有看到”表述为完整隔离通过。

本地 provider 故意使用 `/api/rpc/chat/completions` 路径，提供“合格自配 provider 不被全局路径黑名单误伤”的正向对照。它只解析测试 fixture 的公开 prompt / input；不会读取或复制现有用户配置、cookies 或系统 profile。

商业分类对 `/api/identity`、`/api/rpc`、`/api/blog` 前缀跨域识别，仅精准豁免本次 providerOrigin 的 `/api/rpc/chat/completions`，不豁免任意 localhost 路径。其它上游 hosted/购买路径和 Drive 规则保留，不阻止真实请求。本地 mock 会遵守原文 `translate=no` / `notranslate` 及 prompt 的代码保留约束，避免模型替身修改代码本体而把测试缺陷误报成产品缺陷。

补充实际运行结果以顶层validation.md为准。P02/P06另见`../site-extras/README.md`，真实schema100升级/导入/恢复另见`../config-migration/BROWSER-MIGRATION.md`；下表仅描述本目录runner自身范围，不能把其它runner未在此表出现理解为未测。

G5 后台恢复使用同一脚本自建 profile **完整关闭并冷启动**相同产物，验证持久化 config 与 pending-save；前后两个启动净日志合并保存，重新挂接 Playwright / CDP。此方法明确记录为 `owned-profile-full-cold-restart`。先前 Chrome for Testing 的 unpacked `runtime.reload` 没有重新暴露 worker/popup，是保留在历史结果中的环境限制；新的通过不能声称该 API reload 已成功，也不会删除或改写历史 FAIL。

| 项目     | 受控脚本范围                                                                                                                       | 仍待实际验收                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 常规页面 | 加载 spinner、真实 provider 请求、双语、仅译文、恢复原文、截图                                                                     | 多浏览器与实际模型                                                                                     |
| P01      | `sub` 零行高内块级长脚注                                                                                                           | 真实 GitHub 布局与行内未命中对照                                                                       |
| P02      | 未覆盖                                                                                                                             | 长页显式 AI 动作、2000 字符上限、嵌套表性能和源标题缓存                                                |
| P03      | 已完成双语结果包裹去重、独立新段落、显隐重开与仅译文基础                                                                           | 仅译文动态包裹全组合                                                                                   |
| P04      | 独立 `frameworks.mjs`：实际 React19.3 completed 相同结构 carry、结构改变、pending 重写                                             | error/过期完整组合、真实第三方 React 应用                                                              |
| P05      | 可选 `privacy`：ISOLATED getter 展示零读取、批准自定义动作显式读取及真实 `paragraphs` 入 prompt、敏感字段展示零读取                | search/textarea 全动作、相关段落及直接入口绕过                                                         |
| P06      | 未覆盖                                                                                                                             | 真实 Google 引用卡长译文、内部滚动与局部样式                                                           |
| P07      | 可选 `sites`：Wikipedia URL 的受控 fixture，全局短文本阈值高低对照                                                                 | 真实 Wikipedia                                                                                         |
| P08      | 可选 `sites`：Kaggle URL 的受控 `.learnGuide`、公式节点保持可见                                                                    | 真实指南长译文排版几何                                                                                 |
| P09      | 未覆盖                                                                                                                             | 真实 YouTube 自动字幕 cue 完整时长，无 AI 转录                                                         |
| P10      | 可选 `sites`：ar5iv URL 的受控 fixture，双语/仅译文行内重复代码与纯代码跳过                                                        | 真实 arXiv/ar5iv 与短文本边界                                                                          |
| P11      | 可选 `iframe`：真实鼠标选择懒激活、合成事件拒绝、不透明 sandbox 不激活                                                             | 两级站点规则、跨源显式注入、延迟选择漂移与反复注入                                                     |
| P12      | 全新配置默认、标题关闭/重开及整页关闭恢复、无额外正文请求                                                                          | 旧配置显式 false 与源标题 prompt/cache 全链路                                                          |
| P13      | 未覆盖                                                                                                                             | 真实 YouTube pointer capture / lost capture / 菜单滚动和播放器隔离                                     |
| P14      | 独立 `frameworks.mjs`：实际 Lexical0.52 shadow 深焦点、三空格、编辑后 UI 撤销精确保留空白原文、迟响应                              | 真实 Reddit、IME、Telegram/Discord                                                                     |
| P15      | body 更换后同一 shadow host / 首个 mount 节点、一个 host、浮动控件可用及真实翻译                                                   | 任意内部 React 状态、打开浮层跨 body 更换的状态保持                                                    |
| 本地术语 | 真实 options 新建、CSV 导入/导出、prompt 命中、更新和删除后重译不复用旧措辞                                                        | revision 不同的 pending 合批、fallback/retry、MT 路径与全语言/网站范围                                 |
| G5 子集  | 冷启动净日志、SW / 扩展页 / initiator 取证、hosted status null、旧缓存、pending-save 保留、同 profile 完整冷启、正常 provider 对照 | runtime.reload 环境限制；真实自有登录/会员/额度/网关、全部直接禁用入口、100 配置恢复、完整三上下文覆盖 |
| G4 / G6  | 只有 popup 与术语页原始截图 / fresh config 记录                                                                                    | 双品牌全界面、完整准入、schema100→111、备份/导入/旧包回退                                              |

所有站点域名 fixture 均只拦截对应文档 URL（框架 fixture 同时提供自己的本地打包 JS），以命中扩展站点规则；不会伪称实际访问了 Google/Kaggle/Wikipedia/ar5iv/Reddit 的真实内容。真实 YouTube 和真实 Reddit 未运行。框架 runner 使用真实库；主 harness 普通 DOM fixture 不冒充框架回归。

清理仅关闭本脚本创建的 context / HTTP server，删除本脚本 mkdtemp 创建的 profile。保留 JSON、CSV 和未经拼接的浏览器原始截图供复核。
