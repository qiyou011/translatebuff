# TranslateBuff Fork Playbook

TranslateBuff（任译喵）是 [read-frog](https://github.com/mengxi-ream/read-frog) 的软 fork。上游负责通用翻译引擎、配置 schema、迁移和消息协议；本仓负责品牌 UI、会员/配额、自有网关、渠道归因及产品准入。

## 同步基线与范围

每两周检查一次上游正式 release；紧急修复单独评估。先冻结正式 tag 和完整 SHA，再比较本仓最新业务代码。不要跟随移动的 main 自动升级。

本轮固定 `v1.51.0` / `55bcef1e684fb4e70f4dce3063e7bd3066f46891`，业务起点 `4be99b341a7c940a48794232f066db43339cc2d2`。后续 `1308e8d1` 不在本轮范围。立项、架构审查、实施和验收记录见 [本轮变更](openspec/changes/upstream-sync-v1-51-0/)。

`src/fork/identity/upstream-baseline.json` 只记录**已接纳的完整同步**。候选目标单独写入变更记录；merge、类型检查或构建通过都不能提前推进 `lastSyncedSha`。已接纳基线以该 JSON 为准。

完整源码同步不代表全部产品能力开放。保留本仓自定义功能、UI、会员和批量策略；新增平台、动作、云能力须逐项准入。当前批准本地术语库；上游商业账号、购买、订阅、计费、专属云服务、Drive同步、新平台字幕、学习侧栏和未批准内置动作保持关闭。用户自配 provider 不受商业隔离误伤。

## 工作步骤

1. 读取产品范围和来源，运行 jyopsx 立项/架构审查，生成 proposal、design、specs、tasks。
2. 保存业务起点，使用隔离工作树和 `feat/upstream-sync-YYYY-MM-DD` 分支。先禁用上游 release、submit 和通知副作用。
3. 从固定官方仓库取得已冻结 SHA，并核对 release；只做完整 `git merge --no-ff <固定SHA>`，不 rebase/squash 上游历史。
4. 按贡献解决冲突：A 来源审查、B fork 适配对账、C 验证记录。热点优先复用上游，但不得丢弃已有 fork 修复。
5. 采用目标 packageManager/runtime 安装，使用包管理器生成 lockfile，不手工拼接。package 的引擎版本与 fork manifest 发版号分开。
6. 逐一审查全部 `FORK_UI_REDIRECTS` 和账外 App/controller/hook 副本。上游原件更新不会自动更新实际 fork 路径。审查适配后登记候选源指纹，再用真实 fork 配置验证；指纹只证明源内容已对账，不证明功能正确。
7. 对选择性补丁逐来源确认已吸收效果、保留后续业务贡献，再清除已吸收来源及无剩余贡献的文件记录。不得盲刷113文件指纹或转为永久白名单。
8. 运行主/fork测试、类型格式、固定目标边界、品牌和渠道产物断言；完成构建后用真实扩展包做浏览器与升级恢复回归。
9. 完成 G1—G7、独立审查并记录候选SHA、产物hash、覆盖与缺项。全部通过并接纳后才推进完整同步基线。发布、商店提交、推送及归档单独授权。

```sh
# 已存在 upstream 时先确认 URL，不重复添加。
git remote add upstream https://github.com/mengxi-ream/read-frog.git
git fetch --no-tags upstream 55bcef1e684fb4e70f4dce3063e7bd3066f46891:refs/remotes/upstream/main
# 此处 upstream/main 是本轮来源检查使用的本地引用，固定为正式目标。
git merge --no-ff --no-commit 55bcef1e684fb4e70f4dce3063e7bd3066f46891
pnpm install --no-frozen-lockfile
SKIP_FREE_API=true pnpm run test
SKIP_FREE_API=true pnpm run test --config vitest.fork.config.ts src/fork
pnpm run type-check
pnpm run fmt:check
FORK_SYNC_MODE=1 FORK_SYNC_BASE=55bcef1e684fb4e70f4dce3063e7bd3066f46891 node scripts/check-fork-boundary.mjs
node scripts/check-fork-brand.mjs
```

日常 PR 使用 `FORK_DIFF_BASE=origin/<业务基分支>` 的增量边界检查。同步 PR 必须显式使用冻结的 `FORK_SYNC_BASE`，不能因三点差集已包含上游变化而误用普通模式。边界检查的提交范围与未提交 diff 应分别记录。

## 代码归属和冲突原则

- 上游 schema、DEFAULT_CONFIG、迁移、ProtocolMap、模型/供应商常量归上游；新增 fork 专有配置使用独立存储键。复用上游已有字段，避免第二 schema。
- 净新增 fork 能力放 `src/fork/**`。公开 Provider、hook 和共享状态优先；无公开接缝时保留必要最小副本，不为减少副本重写引擎。
- 原地接缝由 `scripts/fork-allowlist.json` 管理。每项新增差异须有当前需求、影响分析及回归依据，不能全盘 take-theirs 丢失业务贡献。
- 保留页面队列工厂注入、交互/页面隔离、当前合批策略、取消与在途计数。术语 terms/revision 必须贯通 batch key、cache、prompt 和单条降级。
- 上游 `.changeset` 按来源保留；本仓用户可见改动按 AGENTS.md 写 conventional changeset。fork 不运行 `changeset version/release`。
- 每次同步同时复查 [上游问题跟进记录](UPSTREAM_FOLLOW_UPS.md)。

## 重定向与真实测试

`wxt.config.ts` 是重定向清单真源，`src/fork/identity/redirect-baseline.json` 记录 LF 归一化源指纹。路径缺失、指纹缺失和漂移均硬失败。先 diff 并说明“复用/适配/继续禁用”，再更新指纹；不得用刷新指纹替代审查。

主 `vitest.config.ts` 不加载 fork 重定向。主套件通过不能证明 fork 路径已生效；必须另跑 `vitest.fork.config.ts`，并用构建后的真实扩展回归。微软解码漂移哨兵、防重复解码、公开导出契约和 Provider context 均需保留。

## 商业能力四层隔离

1. UI/直接路由：禁用入口及深链可到达内容。
2. 挂载/初始化：不启动未批准的 query、SDK 或侧栏副作用。
3. 后台/消息：直接调用和旧配置不能绕过准入；任务明确结束。
4. 请求前：显式禁用错误/空状态，不伪造成功，不重试或轮询，不自动映射未批准能力到自有收费模型。

前后台 auth 保持空会话，ORPC使用本地拒绝 transport，博客返回空，笔记/Drive后台停用。新增直接 fetch、SDK、API前缀和后台模块必须重新核对。包装原件时，原模块内部调用不会自动指向包装导出，应检查实际调用链。

源码静态检查和产物上游域名字面量告警不能替代网络验收。新包需分别捕获 SW、扩展页、content script 请求，触发默认/旧配置、直接调用及后台重启，并对照正常自有/自配翻译。不得统一拦截请求来制造零请求。

## 版本、渠道与回退

manifest `version` 来源 `src/fork/identity/fork-version.json`，`version_name` 保留上游引擎溯源；`package.json.version` 接纳上游引擎版本。国内/海外 Firefox ID保持本仓身份，最低版本接纳目标140。

- `node scripts/pack.mjs test [--edition cn|global]`：内部测试配置。
- `node scripts/pack.mjs store [--edition cn|global] (--channel <id> | --all)`：生成商店配置产物；出包不等于发布。
- 国内目录 `.output/<browser>-mv3`，海外加 `-global`；运行对应 `assert-fork-build.mjs`，核对跨线域名与渠道。

schema100→111需要旧配置、provider/动作、备份导入与恢复验证。新版写入后旧包不能直接读取时，必须先恢复旧配置/备份再回退。历史归档或新装成功不能替代本轮升级与回退证据。

## G1—G7接纳门禁

| 门禁 | 要求                                               |
| ---- | -------------------------------------------------- |
| G1   | 正式来源固定，完整merge关系与排除范围可核验        |
| G2   | 冲突、选择性贡献、重定向及账外副本逐项对账         |
| G3   | 商业四层隔离，三上下文实际网络证据                 |
| G4   | 本仓功能/UI、15项及术语实际回归                    |
| G5   | 双套测试、类型格式、边界品牌、各目标构建及产物断言 |
| G6   | 真实扩展、旧配置升级、备份恢复与回退证据           |
| G7   | 发布、通知、商店副作用隔离                         |
