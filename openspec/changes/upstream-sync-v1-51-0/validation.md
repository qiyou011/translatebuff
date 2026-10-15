# C：验证与接纳状态

状态：立项、架构审查和完整merge实施完成，实际构建包的受控浏览器回归已运行；仍为候选，未接纳、未发布、未提交商店。

## 候选与产物

- 业务起点：`4be99b341a7c940a48794232f066db43339cc2d2`，原工作区`feat/1.6.0`保持不变。
- 同步工作树：`feat/upstream-sync-2026-10-15`。源码merge候选：`5ac5122a6a4d390b3131f917dd09aa2caf5f5342`，父提交为立项/发布隔离`6a6f0076`与固定正式目标`55bcef1e`。
- 官方目标：`v1.51.0` / `55bcef1e684fb4e70f4dce3063e7bd3066f46891`。未纳入后续`1308e8d1`。
- 已接纳完整基线仍为`1.46.6` / `02ad422c1e1260960e141e4012a20d93e85082aa`。不以merge或构建通过推进`lastSyncedSha`。
- 引擎package版本`1.51.0`；本仓manifest版本`1.5.0`、名称`任译喵 1.5.0（rf 1.51.0）`。
- 国内production Chromium产物`.output/chrome-mv3`：tree SHA256 `2440c52300adfeed0fa087659a2a3dedbda2c614d0c2b7ba12f17654c1253906`；manifest SHA256 `113d6bd55a736bcf4b6013ee4f6acc71a4f8a97b92d6a91244eae993f8af0b56`。
- 海外production代表包`.output/chrome-mv3-global`：tree SHA256 `ea567267f98550bfee72788d6e1e9e2e13e612ee2db28f5e4adc0d07f54f48d6`。本地生成global-zip，不代表上传/发布。
- 实测Chrome for Testing `151.0.7922.34`、Playwright `1.62.1`，独立headed临时profile。Edge/Firefox完成构建，未声称浏览器运行验收。

浏览器记录绑定5ac源码与逐文件产物hash；后续证据/手册提交不改变生产源码和冻结产物。运行前后hash一致。新建profile与本地服务退出后清理，未使用已有用户profile或真实收费密钥。

## G1—G7：沿用附件的正式编号

| 门禁              | 本轮结论                                    | 依据与剩余边界                                                                                                                                                      |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 来源与完整合并 | 来源、merge和贡献对账完成；图深层分析受限   | 53冲突文件已解决、58redirect对账、12补丁/113例外清账。完整detect无partial/truncated；历史impact深度3受工具guard限制，已补直接边/源码/测试，不能称所有impact clean。 |
| G2 工程与产物     | 源码检查通过，证据脚本最终检查单列          | 主4993/fork894测试通过，类型格式、边界品牌、国内三浏览器及海外代表构建和各包断言通过。                                                                              |
| G3 功能与自有业务 | 受控回归通过范围明确；真实业务未签字        | 实包普通翻译、fork UI/动作/术语等已测；真实会员、权限额度、网关、渠道和TG/Discord实站仍须业务环境验收。                                                             |
| G4 品牌与功能准入 | 静态/fork测试和实际截图已覆盖；直接负例另列 | 品牌guard、popup/设置/浮动控件样本保留；默认开启/旧配置准入有源码与测试。未获得产品品牌签字。                                                                       |
| G5 商业服务隔离   | 所测场景零上游商业请求；不宣称完整验收      | 实际SW/扩展页/内容页与冷启动netlog，status null、旧缓存、pending保留、同profile完整冷启和正常provider对照通过。provider为localhost身份stub，真实自有服务仍待验收。  |
| G6 数据升级与回退 | 受控真实旧包升级/回退通过                   | 原5阶段迁移/导入/恢复通过；旧包7阶段全过，配置恢复和完整profile回退均核对实际worker、翻译及缓存，未清空DB。                                                         |
| G7 发布隔离及证据 | 隔离完成，未执行发布                        | merge后复核release/submit job=false；fork CI固定55bcef、目标Node及主/fork套件。完整接纳与实际发布分别决定。                                                         |

**整体不记为全部门禁通过，不推进完整同步元数据。** 剩余项按角色交接，不用构建成功或零请求观察代替实际业务验收。

## 工程与独立审查

最终追加的所有浏览器/迁移/回退证据脚本已再次通过全仓type-check和fmt:check；固定SHA边界、品牌检查与OpenSpec strict验证也再次通过。提交前对已暂存的全部证据文件执行完整detect_changes：793受触及符号、111变动文件、LOW，无partial/truncated/error；见[graph-detect-evidence.json](evidence/source-review/graph-detect-evidence.json)。本次提交仅手册/规划/证据，没有生产源码或构建输入变化；不能把该LOW用于替换前一生产merge的CRITICAL。

源码/脚本/文档的staged diff空白检查通过；终端原始`.log`/`.txt`保留构建表格尾空白，未为通过diff检查改写原始输出。JSON只规范化空白且逐份确认语义摘要不变。

合并前主套件378文件/3781测试通过，1文件/4测试外部skip；fork96文件/795测试通过。

最终生产源码主477文件/4993测试通过，1文件/4测试外部skip；fork111文件/894测试通过。`SKIP_FREE_API=true`有意跳过实时外部free-api测试。类型、格式、边界、品牌检查通过；国内Chrome/Edge/Firefox及海外代表包构建通过，逐包身份/域名/渠道断言通过。原始日志与hash见[engineering/results.json](evidence/engineering/results.json)。

架构审查通过。独立代码审查发现并修复3项P2：术语混批缓存错配、ShadowRoot敏感标签误判、顶层/frame禁用规则绕过。均RED→GREEN并复审关闭：术语原复现2/2及相关16/16通过；隐私/iframe新增5/5及复现/对照8/8通过。

提交前完整GitNexus detect_changes(scope=all)：3671受触及符号、214受影响流程、804变动文件，CRITICAL，无error/partial/truncated，见[graph-detect.json](evidence/source-review/graph-detect.json)。历史影响补查见[impact-followup.md](evidence/source-review/impact-followup.md)：25符号/10文件，20项深度1完整、4项partial及1项外部重导出UNKNOWN；名称查询补直接边，仍不提供完整深度3证明。Button直接129调用/33流程，保持CRITICAL，界面对话框等HIGH未当成LOW。源码与行为测试补充说明同页列出。

## 真实构建包浏览器回归

站点内容为明确标记的受控fixture，使用实际站点URL命中规则。React/Lexical使用真实框架库；没有把普通contenteditable或手工DOM改写冒充框架。模型为本地受控OpenAI兼容服务，可证明实际执行、prompt和缓存传输，不能证明模型翻译质量或真实会员权益。

15项产品范围均有受控实包通过证据，另有术语、迁移及准入回归；完整实站与账号验收另列。

国内主轮`04-49-45.909Z`共12项通过，P10因mock修改code失败；修正mock遵守已有prompt代码保留约束后，国内`04-51-44.917Z`站点/隔离4项全部通过。海外`04-51-44.922Z`完整13项全部通过。历史失败raw保留，未改写为PASS。

| 产品事项            | 实际实包结果     | 证据与限制                                                                                                                                                    |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01 GitHub脚注      | 受控通过         | 块级零行高脚注；真实GitHub排版另验。                                                                                                                          |
| P02 长页上下文      | 受控通过         | 68万字符、36层表，35嵌套表实际展平；最终prompt2000字符、首请求157ms。Markdown前按整节点裁剪实测2182字符，不是转换前精确2000。标题翻译与anchor后源上下文一致。 |
| P03 动态包裹去重    | 受控通过         | 完成译文包裹、独立段落、显隐重开；双语、仅译文和恢复均有实际结果。                                                                                            |
| P04 React19相同重写 | 真实框架受控通过 | 实际替换P、完成wrapper同一节点且0增量HTTP；结构变化不carry、pending旧spinner断开。                                                                            |
| P05 输入value上下文 | 受控通过         | ISOLATED getter展示读0、显式批准动作读取并将canary送入paragraphs；敏感字段展示读0。search/textarea全动作组合另验。                                            |
| P06 Google引用卡    | 受控通过         | 实际内置selector，880px译文、900/270px内部滚动，末端可见、外部容器限制保持。不是实时个性化AI Overview。                                                       |
| P07 Wikipedia短文本 | 受控通过         | Wikipedia URL、全局阈值高/低对照。                                                                                                                            |
| P08 Kaggle Learn    | 受控通过         | Kaggle URL、learnGuide、公式/可见性；真实长指南几何另验。                                                                                                     |
| P09 YouTube自动cue  | 受控通过         | 实际MAIN桥/native timedtext、Chrome录制视频真实currentTime；8个时窗原文/译文与间隙正确，不使用云转录。                                                        |
| P10 LaTeXML行内代码 | 受控通过         | ar5iv URL、双语/仅译文code本体不变、纯代码跳过；原mock错误保留。                                                                                              |
| P11 iframe懒激活    | 受控通过         | trusted鼠标激活、合成事件/不透明sandbox拒绝；顶层/frame双规则单测通过。                                                                                       |
| P12 标题开关        | 受控通过         | 默认、关闭/重开、整页恢复；100升级false保留、源标题缓存由P02补证。                                                                                            |
| P13 YouTube拖拽菜单 | 受控通过         | trusted拖拽、实际capture/lostcapture后恢复，菜单滚动与选择、播放器事件不透传，panel在视频内且层级对照正确。                                                   |
| P14 Reddit输入      | 真实框架受控通过 | Lexical0.52深Shadow焦点、三空格、撤销保空白、迟响应不覆写。Reddit/TG/Discord登录实站另验。                                                                    |
| P15 body替换        | 受控通过         | 同一selection/side host及mount节点，实际浮动按钮仍可翻译；任意打开浮层状态未全面覆盖。                                                                        |
| 本地术语            | 受控通过         | 真实设置页新建、CSV导入/导出、prompt命中、更新/删除后无旧措辞；合批/fallback由行为测试另证。                                                                  |

原始结果：

- [国内主轮](evidence/browser-regression/runs/2026-10-15T04-49-45.909Z/result.json)、[国内P10补跑](evidence/browser-regression/runs/2026-10-15T04-51-44.917Z/result.json)、[海外完整13项](evidence/browser-regression/runs/2026-10-15T04-51-44.922Z/result.json)。
- [React最终](evidence/browser-regression/framework-runs/2026-10-15T04-54-54.487Z/result.json)、[Lexical通过轮](evidence/browser-regression/framework-runs/2026-10-15T04-44-03.934Z/result.json)（该轮React另项失败，不把整轮记全绿）。
- [长页/引用卡2项](evidence/site-extras/runs/2026-10-15T04-53-10.042Z/result.json)、[真实升级/导入/恢复5阶段](evidence/config-migration/browser-runs/2026-10-15T04-41-40.235Z/report.json)。

- [YouTube原生字幕时长/拖拽菜单2项](evidence/youtube-regression/runs/2026-10-15T04-59-32.424Z/result.json)。该runner早期hash序列化只含path/sha256，得到cc6251ce…；同207文件按主runner加入bytes后为同一2440c523…，逐文件对照见youtube-regression下reconciliation记录，不能将不同算法hash作不同包。
- [准入/直接调用10项](evidence/admission-browser/runs/2026-10-15T05-00-28.321Z/result.json)：实际构建模块system引用明确不可重试拒绝、视频缓存null/保存拒绝、新内置动作和noteSuggestion端口拒绝、旧system流式/非流式拒绝、可用本地provider仍不开放新动作、4个关闭深链、正常provider实际DOM译文。340条PW/247条CDP，3次正常provider，商业分类为空。直接模块调用与消息/真实UI已分开记录，不把关闭深链占位页截图作为视觉通过。

## 网络证据边界

国内主轮798条PW/663条CDP、21次正常provider；国内站点补跑519/403、10次provider；海外完整轮791/637、21次provider。商业分类均为空，未用route统一阻断商业请求。只记录公开fixture输入/prompt与脱敏URL，不保存headers、Authorization、Cookie或密钥。

`/api/identity`、`/api/rpc`、`/api/blog`按前缀跨域识别，仅精确豁免本次localhost provider的`/api/rpc/chat/completions`，另含上游商业/Drive规则。PW区分SW/扩展页/普通页，CDP保留initiator，netlog只保留去查询URL/source类型。无法归因的请求保留，不视为完整内容脚本归因。

后台恢复使用**同一自建profile完整关闭后冷启动相同包**。历史CFT unpacked runtime.reload未重建worker/popup的失败保留，不宣称API reload成功。完整冷启动后status仍null、pending原样保留，正常翻译有新HTTP和可见结果。结论为`OBSERVED_ZERO_WITH_LIMITED_SCENARIOS`，不是零网络或完整G5签字。

## 真实旧包升级和回退

独立构建原业务4be99b34旧包（引擎1.46.6、manifest1.5.0），使用其原依赖树的临时克隆；缺失字体只补旧锁定精确包并校验SRI，未替换为候选依赖，主工作区源摘要未变。[最终7阶段报告](evidence/config-migration/rollback-runs/2026-10-15T05-02-08.747Z/report.json)全部PASS。

- 旧包实际创建schema100备份、翻译与重复缓存命中；完全关闭owned profile后保留完整快照。
- 同一固定加载路径显式注册候选，schema100升111。通过CDP Debugger核对运行中worker脚本SHA与磁盘候选一致，不只凭manifest判断。
- 恢复schema100配置后显式注册旧包：实际旧worker在升级后的DBnative60/新增表上，翻译和重复缓存通过；升级前旧缓存、候选新增缓存均保留。未清cache或删除DB。
- 完整恢复升级前profile快照：DBnative40、旧缓存仍在，候选和降级后新增缓存按快照语义不再存在，旧包翻译/options可用。完整快照回到升级前数据，新数据应另行导出，不能宣称无损回退。

同版本unpacked包直接换文件后，CFT曾展示候选manifest却执行旧SW缓存，原超时/失败保留。最终使用自建CFT的unsafe-extension-debugging参数、CDP Extensions.loadUnpacked显式注册并完整冷启；不改候选版本/hash。该环境加载手续不能作为生产迁移失败，也不代表商店升级已测。旧/新匿名popup同viewport原图留存；真实账号和全部IndexedDB业务对象不在此受控样本范围。

## 历史失败与处理

首次脚本替换整个providers数组使默认动作引用失效，schema回落MT；现保留默认项并对实际构建schema做safeParse。仅译文不能按双语wrapper判断。输入完整上下文用消费paragraphs的真实用户动作验证，普通Translate不保证该字段。论文mock原先违反代码保留prompt。以上修在脚本，未为迎合断言改产品。

React最初相同__html被19.3优化而未替换，现以惰性revision属性强制重写，正文/结构不变；后一次首次翻译超时缺ready证据，不能追认精确根因。最终runner等待现有顶层handler应答，仅发一次enable，再只读等待启用状态；fresh profile完整通过。未观察到配置覆盖，未发现需要生产修复的证据。

## 接纳前剩余责任

| 牵头            | 待补事实                                                    | 完成标准                                                          |
| --------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 开发/测试       | 本轮自动化及受控实包回归已收口                              | 最终检查和原始报告见本页；真实业务环境条件另列。                  |
| 测试/业务负责人 | 真实账号/权限额度/网关/渠道、TG/Discord实站、实际发布浏览器 | 最终候选可复核业务结果；Edge/Firefox构建不代替运行。              |
| 产品/测试       | 自有品牌与功能准入、真实站点样本                            | 认可保留业务效果；未批准项无法绕过。                              |
| 开发/测试       | 图工具限制、回退数据边界及G1—G7综合签字                     | 已知影响/剩余限制已审查；旧包不可直接读时采用实际验证的恢复方案。 |

机器可读汇总见[evidence/acceptance-summary.json](evidence/acceptance-summary.json)。历史JSON仅统一格式空白，语义摘要校验不变，失败状态与原始截图保留。

完成接纳前保留上一完整同步基线。实际发布另行绑定自有版本、渠道、批准SHA和发布后验证。本轮未push、发布、上传商店、外部通知或自动归档。
