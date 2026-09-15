## Why

v1.4.0 同时降低页面翻译的 LLM 输入 token 和 Google / Microsoft 单段请求洪峰，优先保证滚动、点击、输入与划词响应。原调研的约 57% 收益及 1001→24 请求仅是旧近似取文的参考，不是当前引擎的验收结果。

原始需求：[产品提案](https://gitee.com/junyun-product/AI/blob/main/translatebuff/openspec/changes/v1-4-0-page-translation-cost-reduction/proposal.md)。代码基线：`8da720d0`，fork 1.3.0 / upstream 1.46.6。

## What Changes

- 页面 LLM 与免费 MT 分别批量，共用页面在途上限；输入/划词保持独立交互通道，字幕不变。
- 仅默认提示采用紧凑 HTML 属性标记与 `{t0…tN}` JSON 协议，保留 sentinel。其他内置及自定义模板保留原协议。用户已确认此兼容边界。
- 严格校验逐项输出，保留成功项，仅失败项一次降级；网络重试与协议失败分开。
- `16 / 4000` 是目标候选，比较 `4 / 1000`、`8 / 2000` 后定档。新装及升级时只迁移精确旧默认对，其他配置保留；老二进制不变。
- MT 候选 100 条并受编码后载荷限制；页面并发候选 4，比较 2/4/6。Microsoft 继续禁止 HTML，Google 保留语义换行。
- 不新增设置、统计面板、遥测、后端路由或网络权限；设置项仍只影响 LLM，字幕文案不改。

## Capabilities

### New Capabilities

- `page-translation-batching`：页面批量协议、失败隔离、交互隔离、并发、升级和可复现实测验收。

### Modified Capabilities

无。fork 边界仍要求精确白名单及评审，本次按现有规则审批增项。

## Impact

新增实现和测试集中于 `src/fork/page-translation/`。架构复审已批准后台队列、后台配置初始化、RequestQueue、Google/Microsoft 适配器的精确接入，以及本次 changeset 单文件例外；不改上游 config schema、message、迁移脚本、全局提示词或 package version。

Google 调用图风险 HIGH，影响连通性检测、翻译中心及默认引擎选择，必须回归原单条契约。缓存继续使用原标记协议；按 scope 隔离在途批次，减少跨标签合并以避免误取消，共享持久缓存不变。

架构复审：`v140_design_review`，2026-09-12，结论「审查通过」。实施不等于发布验收；三页真实快照、六类模型、免费引擎和浏览器性能矩阵通过前，不冻结默认值或宣称收益达标。
