# 1.6.0版本与分支集成检查

2026-10-15，用户授权将本同步worktree合入feat/1.6.0，提交并推送。本文记录提交前版本及门禁证据；具体提交与远端状态以Git分支记录为准，不把本次Git集成视为完整产品验收或正式发布。

- 业务分支起点4be99b341a7c940a48794232f066db43339cc2d2，主目录集成前干净；同步分支已有固定55bcef1e的完整merge历史，保留历史合入，不用文件拷贝代替merge。
- 本仓权威发行配置为src/fork/identity/fork-version.json，版本1.6.0。package.json的1.51.0仍为上游引擎版本；upstream-baseline仍是已接纳1.46.6，不因代码入分支提前推进。
- readForkVersion图影响LOW，12项影响/2个直接文件；computeForkVersion LOW。manifest、会员/上报UA、启动client_version同源。图未识别的JSON/高阶调用由源码及构建补证。
- 安装渠道测试从旧1.5.0字面量改为同源JSON；版本/会员/上报/构建断言8文件108项通过。
- fork全套119文件997项通过；Node开发连接测试2项通过。独立隔离global生产构建成功，manifest为1.6.0，version_name保留rf1.51.0。旧构建及Downloads中的1.5.0候选不覆盖，不能将旧实站结果写作1.6.0实包结果。
- 暂存前后全仓NX格式与类型感知lint通过，固定55bcef边界、品牌与OpenSpec strict通过。原始detect_changes(scope=all)返回185符号、212文件、2流程，MEDIUM，无partial/truncated/error；包含文档变化，不能代替JSON/CSS/构建redirect等图盲点验证。dirty/暂存及未跟踪补查通过，未放宽边界守卫。
- 本轮版本/归档排除/Node fixture增量独立复审PASS；reviewer另验版本相关17项、修改脚本定向类型检查及5文件格式通过。完整产品功能继续沿用前序独立审查及其限制。

## 正常门禁与原始证据保护

pre-commit仍运行lint-staged，pre-push仍运行全仓格式、类型感知lint和主测试；不设置HUSKY=0或使用no-verify。

- 只对[formatter-archive-paths.json](formatter-archive-paths.json)中的59份实际不符合当前格式的历史证据添加精确排除，不用目录或通配符放开其他代码。
- 只对一份已完成实站轮次的归档CJS添加lint精确排除，保留它的原始字节；生产源码和正式测试检查不关闭。
- scripts/dev-local.node-test.mjs的3处Node runner Promise使用显式void；此前首次独立运行因缺少上游兄弟monorepo失败，现以临时Git目录、真实子目录和after清理构造可独立运行的路径正反例。生产dev-local.mjs不改。
- Node测试API在图中UNKNOWN/未收录，已按文件文本确认外部node:test调用；resolveMonorepoRoot图影响LOW/仅1个直接测试消费者。没有以图0caller作为安全依据。
- [immutable-evidence-manifest.json](immutable-evidence-manifest.json)覆盖508份已有及拟提交证据文件，记录字节数与SHA256，用于确认暂存/提交hook不改写原始证据。包括历史FAIL、截图及实站记录，不将历史失败追改为成功。
- 本轮非ignored新增证据大小可正常入Git；文本、结构化记录的凭据扫描无候选。ignored日志、完整编译包和本地浏览器状态不force-add；文档引用的*.log等完整原始命令输出属于本地证据，不承诺这些文件随Git分发。

## 产品验收边界

F01自定义动作执行、F02术语删除真实生命周期、完整G5请求归属及真实成本收益继续待验；H01/H02/Reddit/Telegram继续按用户要求暂缓。版本升级和提交推送不会自动关闭这些项目，也不自动归档、打tag、上传商店或触发被隔离的发布/通知任务。
