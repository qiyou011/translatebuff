# TranslateBuff 开发指南

TranslateBuff（任译喵）复用 read-frog 通用引擎，保留本仓品牌、会员、自有网关及产品准入。操作真源是 [FORK.md](FORK.md)、[AGENTS.md](AGENTS.md)、[OpenSpec规格](openspec/specs/) 与当前变更。

## 1. 日常开发

新增 fork 能力放 `src/fork/**`；优先使用上游公开 Provider/hook/状态及类型消息。视觉定制放 fork 壳或薄包装，通过 `FORK_UI_REDIRECTS` 接线。保留上游原件，不重命名共享组件做品牌化。必须原地适配时，先做图影响分析，说明当前需求和最小接缝，再更新受审查的 allowlist。

上游 config schema、迁移、消息和供应商常量保持上游所有权；使用已有字段，不建立第二份 schema。fork 专有配置才用独立存储键和迁移。用户配置不能因准入关闭而被清洗或改写。

## 2. 同步上游

每两周检查正式 release。冻结 tag/SHA，使用 jyopsx 立项→架构审查→隔离工作树实施→真实浏览器回归。同步分支命名 `feat/upstream-sync-YYYY-MM-DD`，从本仓最新业务代码出发。只完整 merge，不 rebase/squash 共享上游历史。

本轮固定 `v1.51.0 / 55bcef1e684fb4e70f4dce3063e7bd3066f46891`，排除后续1308摘要SVG重排。候选记录见 [本轮变更](openspec/changes/upstream-sync-v1-51-0/)，已接纳基线读取 `src/fork/identity/upstream-baseline.json`。不能因 merge 或 build 通过推进已接纳基线。

先隔离 release/submit/通知，再 merge；按来源和贡献手工解冲突，保留本仓UI/业务/修复。上游 source 全同步后，新增产品能力仍需逐项准入。本地术语允许；新平台字幕、学习侧栏、新内置动作、Drive及上游商业服务关闭。

```sh
pnpm install --no-frozen-lockfile
SKIP_FREE_API=true pnpm run test
SKIP_FREE_API=true pnpm run test --config vitest.fork.config.ts src/fork
pnpm run type-check
pnpm run fmt:check
FORK_SYNC_MODE=1 FORK_SYNC_BASE=55bcef1e684fb4e70f4dce3063e7bd3066f46891 node scripts/check-fork-boundary.mjs
node scripts/check-fork-brand.mjs
```

packageManager/runtime采用冻结目标声明，lockfile由包管理器生成。上游changeset保留，本仓用户可见变更按AGENTS写 conventional changeset，但不运行上游 version/release。日常边界检查用 `FORK_DIFF_BASE=origin/<业务基分支>`；同步必须显式固定 `FORK_SYNC_BASE`。

## 3. 副本与贡献对账

重定向清单以 `wxt.config.ts` 为准；别使用旧文档里的固定条数。上游原件更新不会自动进入 fork controller/hook。核对所有重定向与账外 App 副本、旧选择性补丁及后续业务贡献，然后登记源指纹，运行真实 fork 测试。指纹更新不等于功能已验收。

主测试不带重定向。两套测试、真实产物及UI回归缺一不可。保留微软解码哨兵、TG/Discord/Reddit输入与撤销、页面队列工厂/交互隔离、公式缓存准入及DeepLX降级等当前贡献。

## 4. 商业隔离与隐私

入口/直接路由、挂载初始化、后台消息、请求前四层均检查产品准入。空auth和本地拒绝RPC保留接口；禁用任务明确结束，不假成功、不重试轮询、不自动借自有收费模型执行未批准功能。正常用户provider和自有业务保持可用。

普通text/search/textarea的完整上下文value只在用户显式动作时读取；显示工具栏、取消和后台建议不能提前采集。排除敏感类型/属性，动作时重查连接状态。术语terms/revision贯通合批、缓存、prompt及单条降级，保留现有批量参数。

## 5. 品牌、版本与出包

品牌真源 `src/fork/branding.ts`。manifest版本来源 `src/fork/identity/fork-version.json`，引擎版本来源上游package.json，二者独立。保留本仓国内/海外Firefox ID及渠道归因。

`node scripts/pack.mjs test [--edition cn|global]` 生成内部包；`store [--edition cn|global] (--channel <id> | --all)` 只生成商店配置包。检查各产物manifest、hash、渠道和域名断言后再安装回归。推送、发布、商店提交、通知及归档分别授权。

## 6. 验收与回退

G1—G7要求见FORK.md。新包使用独立profile，记录实际浏览器/产物版本。受控fixture、mockprovider与真实站点/自有网关的证据分开，不把受控页面结果冒充生产验收。商业零请求覆盖SW、扩展页、content script且有正常翻译对照。

schema100→111必须验证旧配置升级、备份和恢复；旧包不能读新配置时先恢复旧备份再回退。历史归档、新装成功或静态域名扫描都不能替代本轮实际证据。缺项继续保留候选状态，不推进lastSynced。
