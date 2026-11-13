# 实施记录（2026-11-13）

用户最新指令：不采用官方资源路线，继续原需求。Azure 官方请求为 0；产品使用现有免费 Google / Microsoft 服务。

## 已实现

- 确定性格式清单、原子绑定、局部样式指纹；粗体、高亮、em/i/u/del、安全代码、键位、输出、上下标、原生 MathML。
- 普通段落和虚拟段落接入；格式变化失效；安全 DOM 重建，不注入服务返回 HTML，不复刻控件和 ID。
- Google 最小 HTML 协议。Microsoft 独立、仅接收序列化清单的无属性标签传输；通用 Microsoft HTML 禁止行为不变。首轮文本标记方案已被替换。
- 标记完整性检查；受控恢复最多一次，仍缺原子则失败；内存和持久缓存均隔离格式身份，损坏与降级结果不进正常缓存。
- 纯文本源码空白折叠；源节点身份、原控件状态和恢复流程保持。

## 验证

全量 `SKIP_FREE_API=true pnpm test`：522 文件通过，7 文件跳过；5311 测试通过，10 跳过。实时 free-api 与显式 opt-in 实验有意跳过。`pnpm type-check`、生产 `pnpm build` 通过。具体日志见 implementation-tests.log、type-check.log、build.log。

实际 Chrome 加载 `.output/chrome-mv3`，通过扩展消息打开双语翻译。两服务各遍历 27 组原型受控案例，动态新增、恢复原文、按钮身份、勾选和展开状态均留证于 browser-acceptance-results.json。截图为真实页面原始截图。`normal` 字段仅表示协议结构校验通过，不能替代语义验收。

## 尚未达到严格交付的项目

- Microsoft F04：高亮应覆盖“pending payment will be checked tomorrow”的全部译义，实际“待”和“检查”仍在高亮外。其余文本完整，但该 P0 子项尚未通过；不得称全部 P0 完成。
- F18 透明诊断文字沿用现有透明元素行为，未擅自全局过滤 opacity:0；隐藏原因的完整逐项验收仍需记录。
- 多语言语义范围、复杂嵌套及超过 8 范围的组合标签真实服务可靠性，不能以离线 round-trip 测试宣称通过。
- 状态变更/缓存的针对性测试及全量回归已运行，但尚未完成全部手动字色、窄屏、故障注入和语言方向验收。

2026-11-13 用户要求 commit 并提交代码，当前实现按此授权提交并推送。严格验收的未完成项继续保留。原站 HTML/CSS 快照和原型受控页需要保持原始字节与 source 片段，已为这三个文件添加精确的格式化排除项。

原站实测：两服务均访问 https://iphone-use.leeguoo.com/en/，首段高亮和粗体可见、导航目标与复制按钮保留，恢复后均 0 译文 wrapper；完整 DOM 见 browser-acceptance-results.json 的 originalSite。F13 新构建已折叠源码换行。

项目 fork 边界检查另有既有基线失败：src/entrypoints/options/app-sidebar/features-nav.tsx 的 selective-patches fingerprint drift。本次未修改该文件，未为通过检查刷新无关指纹。
