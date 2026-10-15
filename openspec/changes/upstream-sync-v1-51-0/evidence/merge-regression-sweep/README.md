# 合并后同类场景统一回归

2026-10-15：本轮统一检查已完成自动化及独立组件浏览器部分，确认并修复6项遗漏，独立审查通过。29条真实设置路由的配置组合挂载通过；这不等于所有真实扩展设置页、所有设置操作或全部业务场景已通过。最终包已更新原加载目录，用户确认重载后，真实内容页Microsoft及自有Kimi划词译文通过；未提交、发布、推进完整同步元数据。

## 范围与固定目标

- 工作树：`/Users/yisen/.codex/worktrees/upstream-sync-v1-51-0/translatebuff`，HEAD `e1d90dc928ca5fbbbba112e480131e1c909c93ce`，本轮修改未提交。
- 上游固定 `v1.51.0 / 55bcef1e684fb4e70f4dce3063e7bd3066f46891`；未引入后续提交。
- 保留本仓品牌、主题、会员/网关和功能准入。未清除用户配置、缓存、账号、术语或动作。
- 用户暂缓的H01、H02、Reddit、Telegram未执行。
- 用户本轮回复“已重载”后，用普通测试文本框真实鼠标拖选并执行翻译，Microsoft与Kimi-K3 (8.00x)均返回可见完整中文译文；只保存公开canary浮层内容和截图，不读取敏感字段。最初只做键盘选择没有建立鼠标事件快照，按实际鼠标流程后正常，不当作产品失败。
- 重装后本轮可见划词模型原为Microsoft；临时选择Kimi完成一次实际模型对照，之后经同一正常浮层恢复Microsoft并关闭浮层。没有更改账号/密钥、清空或重建用户配置。
- 前三项实站修复（自定义指令窄列、Switch状态、选择工具栏设置页崩溃）已由用户确认，未重复计为本轮新增问题。

## 覆盖矩阵

| 范围           | 实际证据与结果                                                                                                                                                                    | 边界                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 设置路由       | 真实fork App、AppShell、RecoveryBoundary、atoms、hooks、懒加载页；29路由×默认/旧云配置58项，加路由一致性、自有合成会话provider、禁用深链安全编辑、实际Layout打开关闭，共62/62通过 | jsdom组件集成；必要浏览器/存储/RPC边界受控，不是真实内部页浏览器验收；并非29路由每个设置均操作                 |
| Layout实际组合 | 真实编辑器懒加载完成、CodeMirror内容、预览嵌套ShadowRoot、宽Dialog标记、关闭且动作配置保持                                                                                        | 实际渲染真实组件；不以jsdom推算CSS几何                                                                         |
| 共享控件与主题 | 用户指定Chrome中，实际Button/Tooltip/Popover/Switch/Checkbox/Radio/Input/Select/Dialog/Tabs与fork CSS独立HTTP样本；亮暗、禁用、焦点/invalid、下拉选择和弹层开关通过               | 不代理或暴露内部设置应用，无账号或业务配置；不替代实际页面整体布局                                             |
| 宽度与断点     | 默认1710px视口下，宽Dialog1280px、预览列608px、500px卡片无横滚；普通Dialog仍640px；620px亮暗容器无外溢，Dialog588×720且可滚动；1100px断点Dialog1068px                             | 1100px双栏预览列502px，500px卡片加padding仍有30px可滚动区域，这是保留的overflow-auto行为；不宣称所有尺寸无横滚 |
| 嵌套结果选区   | 真实fork Toolbar的一层对照、嵌套结果选区RED→GREEN；reviewer补网页自身1/2层ShadowRoot正向对照通过                                                                                  | Selection/几何受控，无真实自定义动作结果浏览器操作证据                                                         |
| Popup摘要      | 实际fork ProvidersField及真实schema/准入/seed/Avatar；词典独占provider、disabled、未准入内置、用户动作4/4通过                                                                     | 图像解码及浏览器边界受控，非实际popup完整浏览器验证                                                            |
| 云拒绝/依赖    | 11类消费者源码与图审计，加真实路由旧云配置和禁用深链回归；未发现第二个云拒绝导致整页渲染错误                                                                                      | 不声称G5零商业网络请求；Drive原始服务仍在，当前可见挂载链未触达                                                |

路由逐项矩阵：[routes-smoke/coverage.json](routes-smoke/coverage.json)；环境与首次fixture失败说明：[routes-smoke/README.md](routes-smoke/README.md)。初次队列页失败是未完整实现的测试存储边界，修正该边界后通过，未改队列生产代码。

## 本轮新增的6项遗漏与处理

| ID        | 用户可见影响/根因                                                                                     | 最小修复与验收                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| S01       | 新“定制化/AI助手”outline-accent沿用旧浅底色当文字，白底对比1.246:1；真实Tooltip/Popover组合还会改slot | 仅options内匹配实际3类slot和text-accent，使用主题primary前景；实际组合亮暗均通过，普通按钮/非options阴性对照通过。亮色文字对比14.116:1 |
| S02       | 新布局回退警告把旧warning背景色当文字，亮/暗对比1.245/1.961:1                                         | 分离options warning-text，保留原填充token；亮/暗对比6.851/10.184:1                                                                     |
| S03       | 旧全局Dialog主题640px覆盖上游新1280px双栏布局编辑器                                                   | 实际Dialog加专用标记，fork CSS仅该实例恢复宽度与5dvh/90dvh；普通Dialog仍640px                                                          |
| S04       | 新xs预览分段按钮被旧通用主题扩为132×40                                                                | options内限定ButtonGroup与h-6类，恢复24px高；普通操作按钮仍132×40                                                                      |
| S05 / W01 | 动作结果新增嵌套ShadowRoot，fork旧单层判断把扩展结果重建为网页选区                                    | 仅对齐固定上游的逐层host遍历；真实Toolbar RED1失败1通过→GREEN，网页自有shadow正向对照仍通过                                            |
| S06 / W04 | 内置词典从customActions迁到builtInActions后，fork popup摘要仍枚举旧数组                               | 用既有获准getSelectionToolbarActions统一枚举；真实DOM RED1失败3通过→GREEN4通过；重复feature槽位和准入保持                              |

[主题审计](theme-audit.md)、[选区/Popup审计](wiring-audit.md)、[词典摘要红绿DOM证据](popup-summary-result.md)、[独立复审](review.md)。主题测试先以浏览器实测数据复现失败，见`theme-red.log`，修复后`theme-green.log`及`ui-composed-buttons-after.json`。审查发现并关闭的组合按钮slot缺口单列保留`review-accent-red.log`，没有把裸Button通过冒充真实组合通过。

## 修改边界与图证据

- 生产修改：`src/fork/ui/options/options-theme.css`、`src/fork/ui/selection-content/SelectionToolbar.tsx`、`src/fork/ui/popup/providers-field.tsx`；共享上游文件`layout-field.tsx`仅增加Dialog实例属性。
- 上游实例属性及4份修复changeset按精确路径登记allowlist；没有目录/通配放行，原守卫未改，旧重定向指纹未批量刷新。
- 共享Button影响CRITICAL（129直接调用、30流程，depth1有界），已告知用户，未改共享Button。DialogContent MEDIUM；LayoutField LOW；Shadow判断LOW/6影响符号；Popup枚举LOW。default-export/构建redirect的0 caller由当前源码链补证，不当作无影响。
- `graph-detect.json`为本机GitNexus CLI同一LocalBackend的完整原始`detect_changes(scope=all)`返回：13个tracked文件、18符号、2流程，MEDIUM，无partial/truncated/error字段。CLI格式化输出只显示前若干条，另存`graph-detect-cli.txt`，不用该摘要冒充完整JSON。
- 索引HEAD与当前HEAD相同；CSS、未跟踪新增测试/证据和构建redirect仍是图盲点。该MEDIUM不替代公共组件原有CRITICAL影响，也不代表所有深层依赖已遍历。
- 原固定SHA守卫只检查提交差集；另用原`classifyChangedFiles`补查当前dirty+非ignored untracked全部路径，见`working-tree-boundary.json`。独立reviewer还验证了合成未登记生产文件会被拒绝。

## 工程与产物

- `SKIP_FREE_API=true`：主478文件/4998通过，实时外部服务1文件/4测试有意跳过；fork最终116文件/969通过、无skip。原始`main-tests.log`、`fork-tests-final.log`。
- 新生产、测试和本轮mjs范围的type-aware lint/type-check、格式检查通过；全仓type-check仍为此前8条脚本诊断（旧实站证据脚本5条、dev-local测试3条），未隐瞒为全绿。原始失败与修正后日志均保留。
- 固定55bcef边界、品牌、OpenSpec strict验证通过。没有提交、push、发版、上传商店或归档。
- 海外正式新包`.output/merge-regression-fix/chrome-mv3-global`，208文件，tree SHA256 **`98d6044a6791952fea27f8875d0efe17c051c47453b52cf6436a392dfa29cca8`**。manifest与14项嵌入环境配置hash对照保持一致；不输出配置值。
- 原四份历史产物逐一hash复核不变。新包以暂存目录校验后替换原下载目录，旧105f包已备份。来源、逐文件hash、备份路径和重载/内容页收尾状态见[artifact.json](artifact.json)。用户已确认重载，随后有实际内容页译文；未以受限的后台/SW检查取得运行bundle hash，不宣称运行身份hash已独立证明。

## 保留的差异与未验收范围

- W02：fork保留品牌药丸工具栏，未采用上游完整MoreMenu/pin/unpin；当前可见自定义动作相对拖拽排序仍有效。记录兼容性差异，不擅自新增菜单。
- W03：fork翻译中心卡片缺目标新增朗读入口，保留为功能范围差异，未在本轮恢复新控件。不能据此称与上游非商业功能完全对等。
- 实际扩展内部页完整视觉/所有操作、真实自定义动作编辑执行、重装后的术语删除缓存复核、实站长页最终payload、Kaggle含公式、YouTube菜单/SRT窄边界、Discord同请求迟响应完成及完整G5归属仍未由本轮关闭；既有受控/实站证据保持原等级。
- 浏览器工具URL策略禁止访问扩展管理页及内部设置页；未以native窗口、CDP、SW、私有存储或HTTP代理内部应用绕过。本轮只新增独立primitive HTTP样本，未触碰用户配置。
- 用户Chrome复用原实例；临时UI页已关闭，18767服务停止，视口override已reset；18765旧业务测试页/服务及YouTube页为继续流程保留。末尾两次截图超时属于采集限制，未当产品失败；此前成功的亮暗/窄屏/宽Dialog截图保留。实际内容页Kimi结果截图`live-kimi-result.png`随后成功采集。

本轮覆盖范围内未留未处理的已证代码缺陷；以上差异与实际验收缺项继续保留，完整接纳状态为false，已接纳上游基线仍1.46.6。
