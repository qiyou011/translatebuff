# 实施证据

## 基线与范围

- 日期：2026-11-10，Asia/Shanghai。
- 基线：`e7bf249251bb8f7dab1ed36d3e5932a4fd03e140`。
- 开始时只有本变更规划目录未跟踪，产品代码没有未提交修改。
- 已读取 CLI contextFiles 中全部工件、原型需求记录、AGENTS.md 及 FORK.md。
- 用户确认覆盖原型：统一两次空格、允许后续 2～5 次；源检测草稿、目标用户设置；不轮换、不跟随聊天；识别失败保留草稿提示且不调用翻译。
- 最终视觉尚待审核，当前使用现有组件承载功能。未进行产品测试或真实平台验收。

## 图分析前置

`node D:/project/translatebuff/.gitnexus/run.cjs analyze D:/project/translatebuff --force --index-only` 成功（20,816 nodes / 51,463 edges / 266 flows），从仓库外启动以避开 devEngines 拦截。仅重建索引，无规则注入。流程枚举有深度/预算截断，不能把未列出的流程视为不受影响。

编辑前 upstream impact：migrateForkConfig LOW，直接调用 loadForkConfig；loadForkConfig UNKNOWN，补充全 src 文本检索确认目前仅声明、没有消费者，不视为通用低风险；fork useInputTranslation LOW，调用者为 selection App；resolveInputTranslationLang LOW，经 resolveLangPair 影响 handleTranslation、键盘触发和 retry；translateTextForInput HIGH，影响新旧 hook 与重译；translateTextCore CRITICAL，影响网页、划词、输入共 23 个符号。已向用户告知 HIGH/CRITICAL，采用既定 fork executor 复用公开核心。setupFork LOW，后台 main 调用；ensureInitializedConfig LOW，涉及后台主入口及网页处理。

## 配置迁移测试

新增 migration.test.ts，首次运行 8 个用例因新迁移函数未实现而失败。实现后运行 `SKIP_FREE_API=true node --import ./scripts/test-env.mjs ./node_modules/vitest/vitest.mjs run src/fork/config`，3 文件 / 16 用例全部通过。范围为纯迁移和既有配置测试，后台原子恢复与 UI 尚未接入，不代表完整升级验收。

## 外部依赖核对

当前 fetchGatewayModels 只解析 `/models` 的 ID 字符串，尚无倍率及发行版分类契约；原型示例不能当作真实计费目录。兑换沿用 membership atoms 的本地化首页 `?redeem=1` 及未登录跳转，翻译中心已有本地 translation-hub；文档仍无正式地址。本条不代表目录或链接已全部验收。

用户在实施中明确批准：模型倍率、国内/海外分类与展示顺序暂缓，待后台接口增加后补充。当前沿用现有可用目录；6.3 的相应部分及两版目录验收保持未完成，不以硬编码原型数据替代。

## 输入翻译与配置专项验证

`SKIP_FREE_API=true node --import ./scripts/test-env.mjs ./node_modules/vitest/vitest.mjs run src/fork/config src/fork/ui/selection-content/input-translation` 最终 exit 0：19 文件、223 用例通过，无未处理异常。新语言测试先对旧实现运行，3 项因仍返回旧语言引用语义而失败，再改为草稿识别。已覆盖 2～5 次、检测失败不请求、检测中路由切换、固定目标完成条、轮换忽略、原始空白、取消/旧 finally/焦点/菜单/发送/Reddit 写回。

后台主初始化屏障、恢复记录、修订冲突及双存储旧通知隔离有专项测试；输入已通过后台快照读取。公共引擎未修改，新增 executor 保留 provider、语言对缓存标签、glossary、hostedFeature 及换行参数。上下文适配器与真实平台验收仍未完成。类型检查在当前配置和输入目录通过；全项目验证尚未运行。

额外 impact：resolveLangPair、toBarSource、轮换状态读写、classifyInputTranslationError 均 HIGH，已告知用户后修改；InputTranslationBar LOW。新建 store/subscription 尚未在原始索引内，impact UNKNOWN 后用文本补查限定了后台接线与测试调用。划词 controller/Provider 编辑前 impact LOW，调用范围为 fork 划词界面。

## 划词与字幕接缝

划词实际 controller 集成测试验证独立源/目标进入核心请求，二次修改仅改变划词目标、全局网页语言不变。通过后完成任务 3.2。

字幕编辑前 impact：UniversalVideoAdapter（上游）HIGH / 43 个影响符号，TranslatedSubtitlesDownloader HIGH / 36，TranslationCoordinator MEDIUM / 32，涉及播放器、YouTube 初始化、startTranslation/refreshSourceTrackIfNeeded。已先告知用户。fork adapter 与 Netflix fetcher 为 UNKNOWN：通过 wxt.config.ts 的重定向及三平台初始化工厂补查其动态消费者，按实际入口影响处理。isApprovedSubtitlesUrl LOW，入口调用；CollapsibleNavGroup LOW，侧栏 3 个影响符号。

字幕新测试先失败：播放队列未传快照、下载未读取注入配置。新增 fork projection，并向上游添加可选 readTranslationConfig/readConfig 接缝、队列 configSnapshot 和运行失效入口；默认读取接口保持兼容。fork 子类继承原件并注入独立语言及订阅，不存在需拷贝的影子引擎。已逐项审阅 universal-adapter.ts 的 diff（34 新增 / 2 删除）并运行主字幕回归：16 文件 / 132 用例通过（含独立字幕投影、队列、下载、平台准入）。依据此对账更新该文件重定向指纹；这只用于允许真实 fork 测试启动，不代表 fork 测试或实平台已通过。X/Netflix 只开放原生字幕，AI 转写/学习侧栏继续拒绝。

## 本地实现交付（2026-11-10）

当前代码已实现四功能独立配置、后台串行字段事务与恢复日志、输入草稿源语言识别、具体目标、2–5 次空格配置、即时等待/错误/重译/撤销、快捷设置与完整设置同步、站点禁用取消、原生三平台字幕准入与独立快照/下载、品牌翻译入口、译文字色持久化，以及新版/旧版备份导入导出和重置。

用户明确安排真实平台验收后续进行。六平台上下文适配器使用本地契约夹具；新增 YouTube 评论/聊天、X 发帖/回复/会话、WhatsApp 同 DOM 换联系人、Reddit 评论/发帖与既有 Shadow DOM 写回回归。选择器未取得实页复核证据，不宣称已经验证这些平台全部编辑器。Discord/Telegram 现有写回回归保留。模型倍率、国内/海外分类及顺序等待后端正式接口；现有提供商目录、会员门禁与选择继续工作。视觉稿、文档正式地址仍未提供。

### 后续影响分析及接缝

ensurePresetStyles HIGH/18、addBackup HIGH/7 已先告知用户；其余备份 UI/导出/自动备份接缝为 LOW。TargetLanguageSelector LOW/3；ThresholdInput LOW/2；TranslationStyleSection LOW/1。writeConfigAtom UNKNOWN，经 17 处实际 Jotai 写入消费者补查，增加可选提交边界；正常 UI 在入口启动阶段安装，普通组件导入无副作用。membership applyConfigPatch LOW/10，改为后台 updateMain。bootstrapHostContent、WXT 各 main 为 UNKNOWN，通过 defineContentScript/defineBackground 与真实入口文件核对调用，保留原生命周期。runStart LOW/6，只加站点准入；initApp（选项、面板、翻译中心）各 LOW/1。默认提供商 selectFreshTranslateProviders LOW/1、promoteMicrosoftDefaultsToGoogle LOW/2：增加可选事务提交器，探测后的字段计算采用最新状态；旧入口默认逻辑保留。requestPageTranslation LOW/2；品牌 TranslateButton LOW/2。新建符号在初始索引不可见时用调用接线和测试补查，不把 UNKNOWN 记为低风险。

原地修改逐组依据见 seam-review.md。指纹更新仅针对已审阅文件；未修改上游 schema/default/migration/翻译引擎。fork manifest 版本改为 1.7.0，上游 package 版本仍为 1.51.0。

### 验证证据

- 主测试：`SKIP_FREE_API=true node --import ./scripts/test-env.mjs ./node_modules/vitest/vitest.mjs run --maxWorkers=8`，exit 0，512 文件通过、1 文件有意跳过；5261 用例通过、4 用例跳过。free-api 依赖外部服务，按 AGENTS.md 跳过。
- fork 实际重定向测试：同上追加 `--config vitest.fork.config.ts src/fork --maxWorkers=4`，exit 0，143 文件、1092 用例通过。首次与主套件高并发运行时路由懒加载等待超时，限制 worker 后通过；没有删除断言或提高超时。
- `oxlint --type-aware --type-check` exit 0；`oxfmt --check .` 全部通过；`git diff --check` 通过。
- `FORK_DIFF_BASE=e7bf249251bb8f7dab1ed36d3e5932a4fd03e140 node scripts/check-fork-boundary.mjs` 通过。该脚本主要检查提交差集，另用它公开的 classifyChangedFiles 对当前 unstaged 与 untracked 文件执行检查，violations=[]。
- `node scripts/check-fork-brand.mjs` 通过。
- 国内/海外 1.7.0 测试 zip 均构建成功，并通过 pack.mjs 内置的测试后端域名/发行版断言；未提交商店。

本机 Node 为 22.23.4，项目声明 Node 26.11.1/pnpm 12.10.1。依赖已存在，测试/类型/格式直接调用对应已安装 CLI。原始 pack.mjs 在 Windows 使用 spawnSync('pnpm') 无法启动 .cmd，临时 `.git/pack-windows-runner.mjs` 将且仅将 `pnpm exec wxt ...` 转到 `node node_modules/wxt/bin/wxt.mjs ...`，pack 的配置注入和产物断言保持原样；没有修改仓库打包脚本、没有变更 lockfile。需在正式 CI 的指定运行时再确认发行环境。本地日志位于 `.git/local-validation-*.log` 与 `.git/local-build-*.log`。

新增行为红→绿证据包含语言解析、字幕队列/下载、WhatsApp 同 DOM 换联系人阻止旧结果回写、默认提供商事务提交。部分补充的集成/缓存/备份用例是在实现后增加的回归，不能追认为逐条 test-first，故任务 8.1 过程项保留未勾选。

### Simplify 审查

移除恒真 configured 分支及永不到达的清空分支；复用既有 ThresholdInput、语言组合框、provider 门禁、字幕队列和翻译核心。颜色使用现有颜色解析加原生 RGB 选择器，避免呈现配置不支持的透明度。配置写入桥从组件模块加载阶段移至真实扩展入口启动；旧自定义动作修复置于 fork 初始化屏障内，防止与新功能迁移并行写入。相关回归后再次执行完整主/fork 套件。

### 回退及待验收

不自动提交、推送、发布或归档。回退前导出当前配置并保留 pre-import 备份；1.6.x 不应直接读取 fork schema v2，需使用升级前备份恢复原版配置后再回退旧包。正式发布前还需实浏览器升级/后台重启/禁用站点检查、六平台输入场景与三平台原生字幕/下载验收、实际网络请求审计及最终视觉验收。

### 最终图分析与产物

索引最终为 20,997 nodes / 52,074 edges / 263 flows。通过 GitNexus 1.6.12 LocalBackend 的同一 detect_changes 工具执行 scope=all、limit=10000；为包含新增文件，复制 Git index 到 `.git/validation-index` 后仅在临时 index 使用 intent-to-add，真实 index 的前后 SHA256 一致。结果：144 个文件、518 个符号、43 个执行流程，`partial=false`、`truncated=false`，整体风险 CRITICAL（公共配置/网页/字幕调用范围），已告知用户。原始 JSON 留于 `.git/local-graph-changes.json`。没有提交。

- `.output/translatebuff-1.7.0-test-chrome.zip`：SHA256 `a086683dc0785a17e245d0ba82cd158b8c666a4ed4434ec0f9c507da23bda41c`。
- `.output/translatebuff-1.7.0-test-global-chrome.zip`：SHA256 `9f612bf4ff5a7c57d7a21250059e43bb936f323da383ec4228efb5b9d074ff49`。

最终本地化对账统一了十种语言中的聊天/输入翻译名称（包括功能标题与提供商分配项），随后重新构建两版 zip；以上 hash 对应最终文案产物。
