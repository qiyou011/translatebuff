## Why

任译喵 1.4.0 的页面翻译、字幕与设置交互存在可复用上游修复的问题。本次以 `917ff2a84501f805bc7c62793abb0847530f28d1` 为代码基线，选择性移植修复并适配实际 fork 执行路径，避免补丁已复制但用户运行的副本没有生效。

需求来源：[上游合并建议](https://gitee.com/junyun-product/AI/tree/main/translatebuff/openspec/changes/v1-4-1-upstream-translation-improvements)。探索阶段已获用户批准，`architect_review` 最终结论为「审查通过」。

## What Changes

- 处理原清单全部 15 条：实施 12 条，另 3 条保留延期及依赖原因；完整 SHA 与逐条状态见 `upstream-fixes.md`。
- 实施 Alibaba RFQ 漏译、划词覆盖层抢触摸、IME 与设置草稿、仅译文禁用提示、公式丢失、分句缓存清理、悬浮控件挡点击、arXiv 标题重叠、保留名称判断、Substack 播放器干扰、YouTube 字幕位置、AI 分句长度修复。
- 延期直播回放 AI 转录防误请求、术语长词匹配、术语通配符说明；当前 AI 转录入口被隐藏，术语库未引入。
- 建立文件级多来源补丁账本，校验官方上游提交来源、最终文件指纹和过期条目，支持选择性移植与后续完整同步并存。
- 补齐公式 token 的后台持久缓存及标签页内存缓存保护；同步运行中的 popup、悬浮控件副本，验证实际设置页与自定义动作路径。

## Capabilities

### New Capabilities

- `upstream-translation-fixes`: 本期 12 条用户行为修复、双层缓存和 fork 实际路径验收。
- `selective-upstream-patches`: 多来源文件账本、官方来源验证、精确内容校验及撤销规则。

### Modified Capabilities

- `upstream-sync`: 为本期选择性移植增加明确例外；完整同步仍使用 merge，保留真实共享祖先和基线。

## Impact

涉及共享配置 atoms、表单与导航、页面 DOM 提取和恢复、后台队列、提示词、站点规则、字幕控制条与缓存清理，以及 fork popup/悬浮控件、重定向指纹、边界脚本与 CI。12 条原始补丁合计触及 110 个不同路径（含测试、locale 与 12 个 changeset），另需本地适配。

GitNexus 已检查核心翻译链路，返回 LOW；`writeConfigAtom` 与组件调用返回 UNKNOWN，文本核对确认存在实际消费者，不能将未知当作无影响。实施前须对实际修改符号补齐 impact，提交前完成无截断的 detect-changes。

不升级上游版本、模型目录、依赖或 fork 版本号，不引入术语库、视频侧栏、AI 转录入口和上游品牌服务。保留任译喵会员、网关、页面批处理及云隔离契约。过期分句缓存清理不可恢复但可重新生成；真实模型与浏览器验证须单独记录，不能以单测代替。
