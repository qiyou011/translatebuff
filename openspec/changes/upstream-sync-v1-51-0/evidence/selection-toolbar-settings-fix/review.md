# 选择工具栏设置恢复页独立审查

结论：审查通过，无阻断。本次修复以空叶子重定向关闭未准入的笔记建议设置，保留
共享 Page 和 ActionsSection；没有放松云 resolver、transport 或改变配置模型。

## 接线和数据

- `wxt.config.ts:375` 的新增源路径匹配 ActionsSection 中的相对导入；现有插件会先
  解析绝对路径再重定向，因此实际 fork 设置页消费 `src/fork/ui/options/note-suggestion-items.tsx`。
- 新叶子仅导出同名组件并返回 null，不挂 provider hook、不调用 resolver、不写配置。
- 原 resolver 在 `src/fork/upstream-services/custom-actions.ts:43` 继续直接抛出
  UpstreamCloudDisabledError；`disabled-rpc-link.ts:6` 继续在本地拒绝请求。
- 现有翻译/朗读设置仍由共享 ActionsSection 写入；真实页面测试确认翻译开关修改并
  持久化、站点设置及朗读入口存在、旧 noteSuggestion.enabled 的 true/false 值未被改写。
- `redirect-baseline.json` 只新增该原始叶子的指纹。独立 SHA256 计算前 16 位确为
  `8d2e9b2e21b01185`，不是批量刷新已有基线。

## 验证

独立运行真实页面、动作准入、ORPC 禁用、提供商列表和相邻页 5 个测试文件，12/12
通过。另在内存恢复原始叶子，页面的 true/false 两个用例都稳定重现原错误；恢复当前
接线后重新跑页面及两个直接 resolver 检查，4/4 通过。未 mock Page、ActionsSection
或 resolver，新增测试确实覆盖实际重定向路径，未以吞掉错误获得通过。

ORPC 回归确认 UI/后台普通调用、query helper 和 streaming 均在本地拒绝且不调用
fetch/sendMessage；动作准入回归保留词典、用户动作及已有保存状态。

## 一次相邻接线检查

悬浮按钮设置页仅挂本地启用、展示和点击行为叶子，没有同类笔记建议 resolver。
API 设置的 `FeatureProvidersConfig`、通用提供商列表及 popup 提供商摘要均已有
noteSuggestion 过滤；对应命令搜索入口也已过滤。此有限范围未发现另一处无条件
挂载该云叶子的遗漏，没有扩大到其他业务模块。

## 边界

本审查没有访问浏览器、实际扩展内部页面或个人配置，没有执行完整套件或新构建，
未修改生产文件或既有布局/Switch 修复。真实扩展页面恢复、构建包和完整候选门禁由
主智能体复检。测试命令、负对照结果与源码哈希见 `review-tests.log`。
