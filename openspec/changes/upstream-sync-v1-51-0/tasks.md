# v1.51.0 完整上游同步实施计划

> **For agentic workers:** 使用 jyopsx-apply-change 按任务实施；独立模块由有界 worker 执行，root 负责合并、契约整合与最终审查。遵循 superpowers:test-driven-development 和 verification-before-completion。

**Goal:** 完整同步固定 v1.51.0，保留自有 UI/业务，隔离上游商业能力并以真实扩展回归证明15项和本地术语。

**Architecture:** 通用引擎、schema/迁移和消息复用上游；fork 保留品牌、业务接线与最小准入。现有批量策略保留，术语revision贯通队列/缓存/fallback；公开Provider/hook优先，必要副本逐项对账。

**Tech Stack:** TypeScript、React、WXT、Vitest、Dexie、pnpm；真实浏览器使用构建后的扩展与独立测试profile。

**Spec:** 本目录 design.md 与 specs/ 下三份规格。

## Global Constraints

- 业务起点4be99b341a7c940a48794232f066db43339cc2d2；官方目标55bcef1e684fb4e70f4dce3063e7bd3066f46891/v1.51.0；排除1308e8d1。
- 保留完整merge历史；不push/publish/store提交/通知/自动归档；未完成G1—G7不推进已接纳基线。
- 所有本地自动化SKIP_FREE_API=true；free-api是有意跳过的外部服务测试。
- 准入不改用户配置；输入完整value仅显式动作读取text/search/textarea，排除敏感字段；术语Drive关闭。
- 编辑前图impact，UNKNOWN源码补证、HIGH/CRITICAL先报告；提交前完整detect_changes，降级结果不算通过。

## Review Focus

- 只选择文本/显示工具栏/取消动作时不得提前读取完整输入值；Task 4以getter计数和敏感字段回归证明。
- 术语修改删除/跨revision合批/单条fallback不得使用旧缓存或混合词条；Task 5的队列和prompt行为测试覆盖。
- 新默认enabled、旧system引用或直接消息不得绕过未批准功能；Task 6验证请求次数为零且正常provider仍可用。
- body替换、迟响应、frame重载和丢失pointer capture不得重挂根或写回旧编辑器；Task 3/4覆盖生命周期。
- 升级失败不能用新装成功代替，旧包回退前必须恢复旧配置；Task 9的升级/恢复证据单列。

## 1. 立项、基线与影响证据

- [x] 1.1 完成立项proposal/design/三份specs/tasks，落实已通过架构审查的value读取、术语revision及发布隔离要求；运行 `jy-openspec validate upstream-sync-v1-51-0 --strict`，预期通过。
- [x] 1.2 隔离分支和依赖就绪；运行根及fork基线测试，记录3781+795等实际结果和外部skip；更新图并记录影响与未知项源码补证。
- [x] 1.3 创建upstream-review.md、adaptation.md和validation.md，绑定起点/固定目标/15项来源、12补丁和46重定向，分开候选与已接纳基线。

## 2. 发布隔离与完整合并

- [x] 2.1 先隔离 `.github/workflows/release.yml`、`submit.yml` 的上游发版/Discord/商店副作用；读取最终workflow验证没有可执行的上游发布路径。
- [x] 2.2 `.github/workflows/fork-guard.yml` 显式固定FORK_SYNC_BASE、SKIP_FREE_API，执行根和fork测试并覆盖类型/格式；工具链与目标声明一致。运行已有脚本测试核验。
- [x] 2.3 图变化核对后保存立项与发布隔离的本地提交；从该提交完整merge固定目标，保留合并关系、列出冲突并再次审查发布隔离。
- [x] 2.4 根维护 `package.json`、`wxt.config.ts`、locale、共享UI及文档冲突；保留自有脚本/品牌资源/环境配置、引擎版本与manifest版本分离，使用目标pnpm重新生成锁文件。

## 3. 页面引擎、后台队列与15项共享修复

**Files:** `src/entrypoints/background/{index,translation-queues}.ts`；`src/entrypoints/host.content/translation-control/**`；`src/utils/host/**`；`src/utils/site-rules/**`；相关原有测试。**Interfaces:** 继续由后台向页面handler注入 `createPageTranslationQueues`，接纳目标routing/取消/缓存/术语参数；不复制第二套执行器。

- [x] 3.1 先运行P01/P02/P03/P04/P06/P07/P08/P10/P12/P15相关测试与现有菜单/显隐回归，记录基线缺口；新增fork特有回归先RED后适配。
- [x] 3.2 合并页面引擎、行内原子、缓存carry和站点规则冲突，保留4be菜单展开修复、c75段落结构和公式/DeepLX兼容，运行相关host/site-rules测试GREEN。
- [x] 3.3 适配目标后台模块拆分与routing/配置/取消接口，同时保留fork页面队列注入和输入/页面请求隔离，运行后台/页面队列集成测试。
- [x] 3.4 核验标题开关复用上游schema及迁移，body替换后同一shadow host/React状态恢复；针对连接状态及清理运行测试。
- [x] 3.5 YouTube字幕时长、pointer capture、菜单事件等目标修复在实际共享路径接入，原有分段/字幕服务fork包装契约保持，运行字幕和相关UI测试。

## 4. 划词、输入与品牌界面

**Files:** `src/fork/ui/selection-content/**`；`src/entrypoints/selection.content/**`；`src/entrypoints/input-injector.content/**`；`src/fork/ui/translation-hub/**`；`src/fork/ui/options/**`。**Interfaces:** 复用目标SelectionSpeechProvider/公共action状态与schema；仅动作消费边界可读取控件上下文，显示快照不持完整value。

- [x] 4.1 为普通/敏感控件、仅mouseup/显示/取消不读完整value编写可观察getter行为测试，运行RED；实现动作时捕获/类型敏感属性连接重查，运行GREEN。
- [x] 4.2 合并选择工具栏/动作schema与目标模块搬迁，App接上语音Provider；保留词典/已有自定义动作和品牌工具栏，新内置动作以Task6准入控制。
- [x] 4.3 fork Toolbar接入同源iframe延迟选区、ready重放及清理；验证可信手势、顶层/frame双开关和跨域/不透明sandbox拒绝，不扩大既有权限。
- [x] 4.4 为Reddit Lexical三空格、深焦点、编辑后旧响应、撤销与TG/Discord保护运行/补齐RED测试；复用目标adapter并最小适配实际fork hook到GREEN。
- [x] 4.5 翻译中心共享独立持久选择/公共状态及现有设置包装，保留自有卡片与服务；运行fork UI与品牌用例证明语音/状态新依赖无context缺失。

## 5. 本地术语库与现有批量策略

**Files:** `src/fork/page-translation/{types,queues,llm,index}.ts`及测试、`src/fork/ui/options`必要包装；上游`src/utils/glossary/**`直接复用。**Interfaces:** 页面任务传递目标MatchedTerm与revision；batch key/cache/prompt/fallback必须表示同一有效快照。

- [x] 5.1 对术语注入、不同revision不合批、修改删除不命中旧缓存、单条降级保词条编写行为测试，运行RED。
- [x] 5.2 保留当前LLM/MT批量参数与请求隔离，贯通匹配词条和revision至最终prompt、缓存和降级；运行fork page-translation套件GREEN。
- [x] 5.3 本地编辑/范围/CSV入口接入自有设置外壳，Drive初始化与授权保持关闭；运行上游glossary与fork准入测试。

## 6. 四层准入与商业服务隔离

**Files:** `src/fork/upstream-admission.ts`、`src/fork/upstream-services/**`及必要重定向；目标字幕平台初始化、动作入口及后台执行边界。**Interfaces:** 明确常量、批准内置ID和既有不可重试禁用语义；不得将禁用功能自动转自有付费请求。

- [x] 6.1 为默认enabled/迁移配置、直接route/消息、未批准内置动作和新平台编写RED测试；添加最小准入与调用边界控制，运行GREEN。
- [x] 6.2 复核空auth、RPC本地拒绝、后台/初始化停用及新目标直接网络出口，保持normal provider与自有服务兼容；运行已有cloud-isolation/legacy-provider测试。
- [x] 6.3 完整merge后再次核对release/submit/通知和相关依赖初始化；静态检查不代替Task9实际网络记录。

## 7. 来源、指纹、手册与版本记录

- [x] 7.1 对12条补丁来源逐贡献核对目标吸收和后续业务修改，形成adaptation记录后清理已吸收来源；对13漂移逐项说明，不盲刷指纹。
- [x] 7.2 逐项核对46重定向/账外App副本并更新已审查指纹，运行FORK_SYNC_MODE=1及固定FORK_SYNC_BASE边界守卫、品牌守卫及相关脚本测试。
- [x] 7.3 更新FORK.md/FORK_GUIDE.md为固定正式版、双周检查、正确同步分支、CI/发布隔离及G1—G7流程；加入conventional changeset，保留上游changesets来源且不执行上游发版。

## 8. 工程验证与独立代码审查

- [x] 8.1 运行 `SKIP_FREE_API=true pnpm run test` 和fork配置全套，记录通过/失败/外部skip；新失败按根因修复并补相关回归，不隐藏既存问题。
- [x] 8.2 运行type-check、fmt:check、固定目标fork边界/品牌检查，完成相关cn Chrome/Edge/Firefox及global代表渠道构建并逐包断言。
- [x] 8.3 检查所有冲突已清理，执行完整GitNexus detect_changes记录partial/truncated/UNKNOWN；必要时修正查询范围并重新分析，取得可复核影响记录。
- [x] 8.4 独立reviewer审查自有适配、隐私、术语链路和隔离；必要问题经回归修复，确认无未解决重要项，保存本地完整merge候选提交。

## 9. 真实浏览器回归与候选状态

- [x] 9.1 构建实际测试包、记录manifest/浏览器版本/代码SHA与产物hash，独立profile加载并确认真实SW/扩展页面/内容脚本启动；测试基线截图保留自有UI。
- [ ] 9.2 真实扩展执行15项可复现浏览器用例及术语编辑/CSV/自有LLM链路；控制页面与受控provider证据和需要登录的实站证据分开标注。
- [ ] 9.3 真实SW、扩展页及content script触发入口/直接调用/旧配置与后台重启，记录零上游商业请求，并对照正常自有/自配翻译及UI；条件不足明确待验收。
- [x] 9.4 验证schema100→111、备份导入与旧配置恢复；确认未批准功能在升级配置下仍禁用、用户provider/动作和品牌状态保留。
- [x] 9.5 汇总G1—G7、最终候选SHA/产物hash/覆盖与缺项；只有全部通过并获接纳才推进lastSynced元数据，否则保留旧基线并交付可审查候选和剩余验收清单；清理本轮浏览器profile/本地服务。

本轮9.2的15项受控实包、真实React/Lexical、术语CSV和缓存已通过；9.3的国内/海外观察、同profile冷启及10项实际消息/port/深链负例已通过。二项未勾选的剩余范围是完整实站及真实自有账号、会员/额度/网关业务验收；localhost身份stub不替代该证据，不声称全商业矩阵通过。升级/回退另有5阶段和真实旧包7阶段通过。最终范围、限制与角色交接见validation.md，已接纳基线保持1.46.6。

## 10. 实站发现的自定义指令布局回归

- [x] 10.1 对当前共享 EntityEditorLayout 结构运行 fork 主题选择器回归，记录旧样式误将整行固定为208px的 RED；记录当前图影响与独立布局复现。
- [x] 10.2 只修正自定义指令页作用域 CSS，保留上游容器查询和自有间距；相关测试 GREEN，加入 patch changeset。
- [x] 10.3 验证宽／窄容器几何、范围隔离，执行相关工程检查并在独立目录构建修复包，保留原冻结包和历史证据；全仓检查的8项现有脚本错误单列，不记为通过。
- [x] 10.4 用户实际扩展设置页复核布局；用户确认“布局已恢复正常”，记为人工视觉通过。
- [ ] 10.5 复核自定义动作编辑／执行；工具不能访问的扩展内部页不以布局视觉确认替代功能通过。

2026-10-15 用户确认“布局已恢复正常”；实际设置页布局视觉已人工通过，动作编辑／执行仍待补验，动作编辑／执行单列为10.5。

## 11. 实站发现的 Switch 主题状态回归

- [x] 11.1 记录共享 Switch CRITICAL 影响并向用户提示；实际组件独立浏览器样本复现亮暗主题 checked 轨道透明、滑块与 off 同在左侧。
- [x] 11.2 恢复有效主题类与同源 Motion 变量出口；设置页 checked 使用现有主题主色和反色滑块，保留上游交互语义。
- [x] 11.3 亮暗主题、大小、启用／禁用、点击／键盘／拖拽验证；工程检查、独立审查与海外候选包更新。
- [x] 11.4 用户重载后实际设置页视觉确认；用户回复“已重载，开关显示正常”。完整同步接纳仍受9.2／9.3剩余边界约束。

## 12. 选择工具栏设置页误挂未准入云功能

- [x] 12.1 追踪渲染期调用链、运行图影响，真实fork页面默认／旧noteSuggestion配置均复现云拒绝错误 RED。
- [x] 12.2 仅新增未准入笔记建议设置的空叶子重定向及已审核源指纹；真实页面可操作、保留旧数据，10项相关回归 GREEN。
- [x] 12.3 主／fork全套、类型／格式／固定边界、独立审查及新海外候选包校验并更新原下载目录。
- [x] 12.4 用户重载后确认“设置页恢复正常”，实际设置页恢复记为人工验收通过；不将此扩大为全部剩余功能通过。

## 13. 合并后同类场景统一回归

- [x] 13.1 建立29条设置路由及合并契约检查范围，区分默认／旧云配置、真实组件／实包浏览器／人工确认；保留用户暂缓项。
- [x] 13.2 真实fork App全部路由挂载及代表性配置操作集成回归，明确环境边界与未覆盖页面。
- [x] 13.3 主题与DOM契约审计；真实独立共享控件在亮暗、大小、禁用、焦点及窄容器下的浏览器验证。
- [x] 13.4 云拒绝消费者及popup／Hub／选区App依赖接线审计，排查未准入组件渲染与新共享契约遗漏。
- [x] 13.5 对新发现先复现、影响分析再最小修复，独立审查；不以清配置／关闭隔离绕过失败。
- [x] 13.6 汇总统一回归矩阵、实际新增问题和未完成边界，运行最终工程门禁；如有生产修改，构建新候选而保留原包。

本轮13.2—13.6覆盖的自动化、独立组件浏览器、最小修复及审查已完成；完整内部页视觉、实站及G5仍按9.2/9.3保留，详情见evidence/merge-regression-sweep/README.md。

- [x] 13.7 用户确认重载后，普通网页实际扩展划词及Kimi真实译文收尾；模型选择恢复、测试浮层关闭。未将该内容页smoke扩大为完整内部页验收。

## 14. 原翻译降本保留性复核

- [x] 14.1 对照原降本实现、4be业务基线及固定上游，核对实际后台注入、参数、协议、队列与缓存；历史收益发布门不追认为完成。
- [x] 14.2 真实后台处理器、fork队列与AI SDK受控HTTP量化LLM合批、术语分组、重译缓存及失败降级；不以mock usage声称真实token节省。
- [x] 14.3 量化Google/Microsoft边界、真实页面并发和输入隔离，回归取消、DeepLX探测、迁移与内容缓存。
- [x] 14.4 空有效词条缓存失效RED→GREEN；先完成影响分析、架构复审和规格修订，保留非空revision及删除保护，进行独立代码复审。
- [x] 14.5 最终工程门禁、产物及已加载目录保留性校验；如有生产修复构建新候选，记录可复核结论及真实浏览器/成本未验收范围。

本轮源码对账、受控HTTP与缓存回归、独立复审及新包校验已完成，主4998/fork997通过。新包已更新原目录，尚未由用户重载；真实账单、浏览器IndexedDB及原降本5.1—5.4发布门不在本轮通过范围。完整证据见evidence/cost-reduction-preservation/README.md；9.2/9.3及用户暂缓项保持原状态。

## 15. 分发包排除仓库维护与验收材料

- [x] 15.1 核对WXT安装/源码ZIP的真实收集链及图影响；用实际文件选择器复现文档泄漏，保留运行与重建材料正向对照。
- [x] 15.2 最小补充两类包的目录排除，保留源码审查构建说明和运行资源；定向回归RED两项→GREEN及相关35项通过。
- [x] 15.3 真实生成安装ZIP与sources ZIP，检查禁止目录零命中及必要文件保留，对照1.6.0运行产物内容。
- [x] 15.4 完成独立复审、最终测试/类型/格式/边界与规格门禁，记录可复核的打包证据；不提前关闭产品待验事项。
