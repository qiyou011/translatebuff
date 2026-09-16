## 1. 并发与配置基础

- [x] 1.1 在 fork/page-translation/**tests**/request-concurrency.test.ts 先覆盖上限、完成唤醒、超时/取消底层迟结束、非法参数、未设置上限原行为；实现 RequestQueue 可选 maxConcurrent，跑新旧队列测试。
- [x] 1.2 实现 policy.ts / migration.ts 与 background/config.ts 共享初始化；测试精确4/1000、新装、自定义组合、重复启动及写入失败恢复；保留字幕和其他配置。

## 2. 协议与适配器

- [x] 2.1 实现 wire.ts：真实属性紧凑转换、canonical恢复、id冲突、raw-text/注释保护、flat JSON重复/未知/缺失/空值及sentinel测试。
- [x] 2.2 实现 llm.ts：默认与自定义协议分流、provider/prompt快照、网关JSON mode、reasoning/options不变；测试网络与协议错误分界和原路由保留。
- [x] 2.3 扩展 Google/Microsoft page raw批量入口，复用单条编解码；测试多项响应、部分缺失、错位、HTML禁用、Google换行和单次实体解码，原单条测试回归。

## 3. 页面集成

- [x] 3.1 实现 fork queues.ts：两个BatchQueue、Outcome、队列外校验、失败项单次降级、载荷分批、完整分组键；测试无占槽死锁、不重发成功项、429/auth/abort不降级。
- [x] 3.2 接入 translation-queues.ts：页面与交互隔离、scope取消/迟响应cache保护、配置watch更新；测试真实消息路径及双标签取消，字幕回归不变。
- [x] 3.3 更新精确fork白名单、发布记录和同步对账说明；验证变更文件边界，不修改上游package version或运行changeset release。

## 4. 自动化与构建

- [x] 4.1 执行 root / fork redirect 两套测试、type-check、修改文件格式、diff check、完整GitNexus变更分析；记录实际结果而非推测。
- [x] 4.2 构建 Chrome / Edge / Firefox 并验证fork品牌、版本、入口及重定向实际生效。

## 5. 实测与发版门

- [ ] 5.1 固定三页真实取文快照、记录hash/模式/语言/preload/cache/tokenizer；比较LLM三档与MT100/载荷边界，生成包含所有重试和降级的报告。
- [ ] 5.2 六类真实模型和Google/MS真机请求验证；质量/marker/失败率不退化，验证token≥50%与MT目标，保留provider实际usage口径。
- [ ] 5.3 真浏览器并发2/4/6、首结果median、滚动点击输入及划词延迟、长任务对比；首结果≤+20%，交互不退化。
- [ ] 5.4 根据实测冻结默认值和迁移目标，fork-version升1.4.0，更新验收报告与回滚检查；证据不足时本项必须保持未完成。

## 6. 同版启动埋点（2026-09-15）

- [x] 6.1 TDD 接入 install/update/startup 生命周期事件、官网 Cookie sn 与活跃事件同源 sn；复用请求、渠道与版本真源，保留活跃去重和静默失败。
- [x] 6.2 执行定向回归、类型/格式、构建、OpenSpec 与 GitNexus 检查，记录实际证据。
- [ ] 6.3 发布前确认 MUL-169，验证浏览器安装/更新/冷启动/重装、国内海外渠道及中台收数；登记产品埋点台账并同步钉钉表。本次不发布或代操作外部台账。

2026-09-15浏览器补验：国内Chrome测试包已生成。独立Chrome for Testing 151中先卸旧装新，install/update/startup、同源SN、卸载重装保留、真实页面翻译与活跃去重、SW普通唤醒不误报均完成，相关真实请求HTTP200。日常Chrome资料待用户选择后替换；海外/其他浏览器、服务端入库/台账及MUL-169仍未验，6.3保持未勾选。详见 [启动埋点浏览器报告](calibration/startup-browser-qa.md)。

2026-09-15 埋点验证：新增13项集成测试先红（12失败/1通过，未注册启动监听），接入后 analytics/翻译触发53项通过；扩大后台/identity回归101项通过。`SKIP_FREE_API=true pnpm test` 全量358文件通过、1文件跳过，3507项通过、4项跳过（外部免费API按项目约定跳过）。type-check、修改代码格式、diff check、OpenSpec strict均通过；Chrome/Firefox生产构建通过（仅构建，未分发；存在chunk大小提示），国内Chrome域名断言通过（既有上游回退域名提示保留）。工作树13文件边界分类无违规。GitNexus原始detect_changes输出完整，无partial/truncated，已跟踪文件19符号/9流程/HIGH，主要为公共setupFork及文档连带；新文件不进入git diff统计，另经重建索引/context确认启动→postClickEvent与两个事件→getReportDeviceInfo连接。只读代码审查无阻断问题。6.3及原5.1–5.4保持未完成，不提交、不推送、不发布。

2026-09-12进展：三页取文/hash、静态LLM三档比较、线上16/4000与MT100/载荷边界、四个新增网关模型冒烟、页面饱和时输入队列隔离，以及React/Google并发2/4/6各三次已完成，见 [实测报告](calibration/README.md)。尚缺原生接口、完整真实成本、旧版性能基线与真实业务交互；三页Google请求合计51次，≤30目标本次未达。按用户确认，将无法配置的接口及其余待验项交测试配置补验，见 [测试交接清单](calibration/qa-handoff.md)。父任务未全满足，仍为10/14，不勾选5.1–5.4。

2026-09-15补充：为消除测试人员无法区分新旧 `1.3.0` 包的问题，已将 fork-version 提前升至 `1.4.0` 供内部候选包复测。该动作仅解决构建身份可辨识性，不代表默认值、迁移、回滚或多浏览器发布验收完成；5.4 继续保持未勾选。

每项执行顺序：写独立手工期望的失败测试 → SKIP_FREE_API=true pnpm run test <该文件> 确认失败 → 实施最小改动 → 同命令及相关原路径回归通过 → 勾选。详见design.md接口及决策；不自动commit/push/archive。
