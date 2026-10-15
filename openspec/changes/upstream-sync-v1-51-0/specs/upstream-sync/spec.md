## MODIFIED Requirements

### Requirement: 上游 remote 与共享祖先不变量

系统 SHALL 配置指向官方 `mengxi-ream/read-frog` 的 `upstream` git remote，并 MUST 保持 fork 与已合入上游提交的共享历史，完整同步仅通过 merge 保留上游提交 SHA，不对 `main` 已有上游历史进行 rebase 或 squash。同步目标 SHALL 是经审查固定的正式 tag 及其完整 SHA，而非随时间变化的 `upstream/main`。

#### Scenario: 验证官方来源与目标祖先

- **WHEN** 准备接纳一次完整同步候选
- **THEN** `upstream` 指向官方仓库，正式 tag 解析为审查记录中的完整 SHA，且该 SHA 是候选 merge 结果的祖先；祖先检查错误 MUST 明确失败，不能以无法解析对象冒充正常结果

#### Scenario: 拒绝破坏共享祖先的历史改写

- **WHEN** 有人尝试对 `main` 已有的上游提交执行 rebase 或 squash
- **THEN** 该操作被 `FORK.md` 与团队约定禁止；同步一律通过 merge 完成，保留稳定上游提交 SHA 和完整 merge 历史

### Requirement: merge-only 同步仪式

系统 SHALL 从记录的 fork 业务起点创建 `feat/upstream-sync-YYYY-MM-DD` 隔离分支，先审查并隔离上游发布、通知及商店动作，再完整 merge 固定正式 tag；MUST 在 merge 后重新核验隔离。锁文件 SHALL 由项目声明的包管理器安装流程生成，不手工拼接。冲突 MUST 按文件的来源、上游贡献和 fork 契约逐项处理，不默认批量 take-theirs。源码合并完成仍是待验收候选，只有 G1—G7 全部通过才能接纳为完整同步。

#### Scenario: 执行本轮固定版本同步

- **WHEN** 从业务起点 `4be99b341a7c940a48794232f066db43339cc2d2` 在 `feat/upstream-sync-2026-10-15` 执行本轮完整同步
- **THEN** 完整 merge 的目标严格为 `v1.51.0 / 55bcef1e684fb4e70f4dce3063e7bd3066f46891`，保留完整历史，不追加 `1308e8d1`，不追随 `upstream/main` 后续移动

#### Scenario: 处理冲突与锁文件

- **WHEN** merge 产生源码、fork 副本、配置或锁文件冲突
- **THEN** 先核对每个冲突的上游变化和本地契约，再选择复用公开入口、薄包装或必要副本；锁文件由声明的安装流程生成，不能通过扩大 allowlist、批量刷新指纹或整体覆盖 fork 跳过审查

#### Scenario: 启用 rerere 记忆冲突解法

- **WHEN** 完成 `git config rerere.enabled true`
- **THEN** `git config --get rerere.enabled` 返回 `true`；复用的冲突解法仍须按当前正式版本和 fork 契约复核，不将历史解法当作本轮验收

#### Scenario: 仅选择性移植而未完整 merge

- **WHEN** 某轮只移植批准补丁，没有完整 merge 固定正式目标
- **THEN** 仍按 `selective-upstream-patches` 的来源与最终内容账本约束执行，不宣称完整同步、不推进 `lastSyncedSha` 或 `lastSyncedVersion`，保留自有会员、网关、批处理及云隔离契约

### Requirement: 同步仪式落盘文档

系统 SHALL 在仓库根 `FORK.md` 维护权威同步手册，规定双周检查正式 tag、目标 tag/SHA 冻结、隔离分支、先发布隔离后 merge 及 merge 后复核、逐项冲突处理、来源对账、G1—G7 验收和回退方式。手册 MUST 将同步与发布分开，不默认合并 `upstream/main` 或批量 take-theirs。

#### Scenario: 按手册开始下一轮同步

- **WHEN** 维护者进行双周检查或准备下一次同步
- **THEN** 手册要求先选择并记录固定正式 tag 和完整 SHA，使用 `feat/upstream-sync-YYYY-MM-DD` 分支，保留 merge-only 不变量；热点清单提供逐项审查边界，不授权自动丢弃 fork 改动

#### Scenario: 本轮同步已验收但尚未决定发布

- **WHEN** G1—G7 完成且同步候选获接纳
- **THEN** 手册仍要求另行决定发布，不因此自动 push、publish、归档、执行上游 changeset 发版、发送 Discord 通知或提交浏览器商店

## ADDED Requirements

### Requirement: 来源账本与 fork 覆盖逐项对账

系统 SHALL 在完整 merge 后，对选择性补丁来源、文件贡献、累计指纹、全部 fork 重定向及账本外 App 副本进行逐项对账。已由固定目标吸收的来源 SHALL 在确认本地必要贡献后按既有账本规则清理；指纹漂移 MUST 先核对差异与贡献，不能只刷新指纹使检查变绿。

#### Scenario: 本轮已有来源被目标吸收

- **WHEN** 核对已有 12 条选择性来源与 `v1.51.0` 的祖先关系
- **THEN** 记录目标已吸收的来源，检查对应最终文件和 fork 特性保留情况后清理冗余来源及贡献关系，最终整个账本预检通过，不把来源行删除等同于贡献已被保留

#### Scenario: 已登记文件发生累计指纹漂移

- **WHEN** 审查起点存在 13 个账本文件指纹漂移，或实施中发现新的漂移
- **THEN** 每项先记录实际内容差异、来源贡献和保留决定，经审查处理后才更新或移除对应条目；未触及文件的漂移同样不能略过

#### Scenario: 逐项核对重定向及账外副本

- **WHEN** 本轮固定目标改变了 46 条重定向中的 23 个上游原件，且另有未进入该表的 App 副本
- **THEN** 对全部重定向及账外副本逐项记录上游变化、实际执行路径与适配决定；无文本冲突不免除功能贡献核对，不批量全收或全弃上游变化

### Requirement: 完整同步接纳状态与元数据一致

系统 SHALL 将来源审查、源码合并、工程验证、真实功能及网络验收区分为可核验状态；`lastSyncedSha`、`lastSyncedVersion` 及等价完整同步接纳元数据 MUST 仅在 G1—G7 全部通过后推进到固定目标。临时候选构建可记录目标标识，但 MUST 不冒充已接纳基线。

#### Scenario: 源码已 merge 但仍有门禁待验收

- **WHEN** 完整 merge 已成功，但任何 G1—G7 项未通过、缺证据或仍待账号和设备条件
- **THEN** 状态保持待验收候选，原已接纳基线不变；报告明确缺项，不能将构建成功、历史归档或通用测试通过当作整体接纳

#### Scenario: 全部门禁通过后接纳

- **WHEN** 同一冻结候选的 G1—G7 证据齐备并获接纳
- **THEN** 才将完整同步元数据推进至 `55bcef1e684fb4e70f4dce3063e7bd3066f46891 / 1.51.0`，保留起点、目标、merge 结果、审查与产物的追溯记录

### Requirement: G1 到 G7 验收绑定冻结候选和真实产物

系统 MUST 按 G1—G7 分别记录验证命令、环境、结果和证据，绑定候选代码 SHA、构建发行版及实际产物。发生影响已验证行为的候选改动后，相关证据 SHALL 重新验证；未知、跳过和不可运行 MUST 与通过区分。

#### Scenario: G1 来源与图分析

- **WHEN** 执行 G1
- **THEN** 固定来源、祖先与完整 merge 历史核对通过，来源及覆盖账本完成对账；编辑前完成目标符号影响分析，提交前完成完整图变化分析，`UNKNOWN`、`partial` 或 `truncated` 不被当作低风险或干净结果

#### Scenario: G2 工程与构建包

- **WHEN** 执行 G2
- **THEN** 安装与锁文件一致，相关测试、类型、静态检查及边界守卫通过，完成国内 Chrome、Edge、Firefox 三浏览器构建和海外代表包构建；本地测试使用 `SKIP_FREE_API=true`，单列 `free-api.test.ts` 为外部免费在线服务有意跳过，不计作该服务已验收

#### Scenario: G3 实际 fork 功能

- **WHEN** 执行 G3
- **THEN** 使用实际加载 fork 重定向的构建包回归 15 项重点修复、本地术语全链路和已有自有功能；真实浏览器结果记录浏览器版本、构建环境、产物路径或指纹及使用条件，不能以源码测试或构建结果代替

#### Scenario: G4 品牌与功能准入

- **WHEN** 执行 G4
- **THEN** 国内任译喵、海外 TranslateBuff 品牌及现有主题、图标、布局得到核验，已批准入口可用，未审查 X、Netflix、sidebar、新增内置动作及上游商业入口保持关闭，既有词典及用户自定义动作保留

#### Scenario: G5 三执行上下文网络隔离

- **WHEN** 执行 G5
- **THEN** 以真实构建包分别覆盖 Service Worker、扩展页面和 content script 的冷启动、交互及旧配置恢复，验证上游商业及独家云服务请求为零，同时自有登录、权限、额度、模型网关和合格自配 provider 正常；网络记录与产物和环境绑定

#### Scenario: G6 配置升级及备份恢复

- **WHEN** 执行 G6
- **THEN** 真实 schema 100 配置沿上游链升级到 111，已保存 provider、凭据引用、动作、站点规则及 fork 业务状态保持有效；验证升级前备份、导入恢复及回退操作，明确新版配置不被假设可由旧包直接读取，不以全新安装代替升级验收

#### Scenario: G7 发布与通知隔离

- **WHEN** 执行 G7
- **THEN** 对 merge 前后的工作流、发布脚本、changeset 发版、Discord 通知与商店提交路径完成审查；CI 使用完整且冻结的 `55bcef1e684fb4e70f4dce3063e7bd3066f46891` 验证目标，不能通过变量回退到移动分支或其他 SHA，验证过程中不产生上游发布与通知副作用

### Requirement: 上游工具链与配置演进复用同一体系

系统 SHALL 跟随固定目标的依赖工具链、配置 schema 100→111 和 Firefox 最低版本 140，复用上游公开 schema、消息和迁移链；MUST 不以薄包装之外的平行框架或第二 schema 兼容本轮功能。运行时旧模型兼容自身不新增持久化迁移的既有约束 SHALL 保持成立。

#### Scenario: 新功能需要配置或迁移

- **WHEN** 接入标题开关、术语或目标版本其他获准配置变化
- **THEN** 使用固定正式目标已有字段、默认值和迁移，保留用户显式选择，不向历史冻结迁移文件注入当前常量或 fork 新体系

#### Scenario: 准备验证 Firefox 与回退

- **WHEN** 构建、安装或恢复配置以执行浏览器回归
- **THEN** Firefox 环境满足最低版本 140，记录实际工具链和浏览器条件；回退使用经验证的旧包与升级前备份，保留用户数据恢复路径
