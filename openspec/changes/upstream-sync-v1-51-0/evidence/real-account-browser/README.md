# 国内测试环境：真实账号与实站复测

2026-10-15 本轮已执行，结论为 **核心链路通过，存在问题与覆盖缺口，不记为全部验收通过**。

## 环境与身份

- 源码候选 `5ac5122a6a4d390b3131f917dd09aa2caf5f5342`；构建快照 `e1d90dc928ca5fbbbba112e480131e1c909c93ce`。
- 国内测试官网 `https://test.translatebuff.cn`，自有认证／claw `https://cbs1sit.htjsq.com`。
- 登录后实际注入网关 `https://oneapi-test.6fast.com/v1`，不是配置中的后备网关。
- Chrome for Testing `151.0.7922.34`、Playwright `1.62.1`；真实构建扩展、专用临时 profile。未使用 fixture、模型 stub 或路由伪造响应。
- 用户在浏览器中手工完成测试站 Basic 认证与账号登录。扩展实际 cookie／会话存在、会员为 Pro、剩余额度为正；8 个自有模型实例的密钥存在且一致。未保存密码、验证码、cookie 值、token、密钥或用户资料。
- 测试通过保留其余 config、选择真实托管 `renyimiao-prefer_quality_optimized`、开启 Control 悬浮翻译进行准备；账号初始页翻译 provider 并非托管模型。除真实模式快捷键外，准备阶段以 storage 设置模式。整页翻译保持关闭。

[国内测试构建记录](build-cn-test/2026-10-15T07-17-26-803Z/build-result.json)使用原标准 `pack test --edition cn`，在独立源码／依赖副本构建；未覆盖原生产包。产物 207 文件，tree SHA256 `841c7a8c620366d2724b2e290096f69cbae4fa0d6722e48c41af5c977d563e57`。

## 实际结果

| 场景 | 结果 | 实际证据 |
| --- | --- | --- |
| 官网登录同步到扩展 | 通过 | 会话／托管密钥存在，Pro、额度为正；冷启动后仍在。 |
| 自有会员 UI | 通过 | Pro 徽章、剩余用量、到期、我的订单实际可见。 |
| 设置页更新模型 | 通过 | 真实 GET `/v1/models` 为 200，UI“已更新 8 个模型”；密钥控件仍只读且遮罩。 |
| 设置页测试连接 | 通过 | 真实 `Hi` 翻译 POST 为 200，UI“成功”。 |
| Wikipedia 正文双语 | 通过 | 可信鼠标／Control 事件、真实网关译文、原文保留；再次触发精确恢复。 |
| Wikipedia 仅译文 | 通过但有 H01 | 中文可见、英文源文不再显示，恢复精确；快捷键切换后首次 Control 无动作，第二次成功。 |
| 真实 LaTeXML 论文 | 通过 | 原复现论文 `https://arxiv.org/html/2609.26891`，278 个 listing span；`S1.p2` 的 3 个 `invoke` 在双语与仅译文模式均保留，恢复精确。 |
| GitHub 脚注 | 未通过完整验收 | 真实 sup/sub 存在，但出现 H02；未验证目标多行零行高块重叠边界。 |

[机器可读观察结果](2026-10-15T07:19:01.909Z/observations.json)记录实际工具返回结果与断言。原始浏览器截图：

- [Wikipedia 双语](2026-10-15T07:19:01.909Z/wikipedia-bilingual.png)、[仅译文](2026-10-15T07:19:01.909Z/wikipedia-translation-only.png)。
- [论文双语](2026-10-15T07:19:01.909Z/arxiv-inline-code-bilingual.png)、[仅译文](2026-10-15T07:19:01.909Z/arxiv-inline-code-translation-only.png)。

## H01：切换模式后第一次悬浮按键不触发

实测两轮：正文恢复原文 → `Alt+Shift+M` → 鼠标保持目标段落 → 首次独立 Control 无译文 → 再按 Control 成功；双语与仅译文各一轮均复现。不是等待 wrapper 的单一断言问题，实际无动作与第二次成功有对照。

源码定位为 `src/entrypoints/host.content/translation-control/node-translation-trigger.ts` 的按键会话纯度：非 Control keydown 可将 `isHotkeySessionPure` 设为 false；下一次 Control down 不恢复；Control up 不翻译并复位，第二次才正常。

只读 Git 对照：旧业务 `4be99b34`／立项 `6a6f0076` 的文件 blob 相同为 `bda2a382`；上游目标 `55bcef1e`／候选 `e1d90dc` 同为 `a8446ae2`，差异仅新增 selection shortcut claim 监听，以上纯度逻辑原已存在。因此记录为**候选实测复现、相关逻辑旧基线已有**；未对旧二进制重跑这个精确手势，不能说旧包本轮实测已复现。

未为通过本次回归修改生产代码；该问题仍待修复／确认。不能用此前直接写 mode 的受控测试掩盖它。

## H02：GitHub 场景非预期大范围翻译与 429

GitHub 目标段落进入翻译后没有在初次 30 秒断言时完成。随后现场统计：GitHub 136 个 wrapper、Wikipedia 5 个、论文／Kaggle／Google 为 0；公开后台消息查询的各页整页翻译状态均为 false。本轮结束前实际网关响应累计采样为 **177 次 200、10 次 429**，其中包含此前正常场景，不能全部归入 GitHub。

按键瞬间实际选中的 DOM 节点与坐标未保存，当前不能证明选择了哪个祖先容器。源码不会将正常 block P 自动升级为 article，但若几何命中容器，悬浮入口会遍历其子树。不能将本次直接定性为产品新增回归、自动启用整页、滚动不足或单纯限流。429 响应正文未读取，也不能据此认定额度耗尽或服务容量不足。

已关闭本轮专用 browser/context，终止其 service worker 内存队列。单关标签页、对已关闭的整页再次发 disable，不能证明无 session 的悬浮后台重试已取消。后续复现应先记录可信 mouseover／mousemove 与 `elementsFromPoint`，确认最近 block 正是目标 P，再发真实按键，并设置有限的请求观察边界。

## 仍未覆盖的实站边界

- Wikipedia 79 个嵌套表已观察，但未执行长页 AI 动作 2000 字上下文断言、全局短文本阈值高低对照或标题开关对照。
- Google 进入 `/sorry/index`，未到 AI Overview 引用卡。
- Kaggle 指南 HTTP 200、8 个 `.learnGuide` 匹配、2 个正文 p；当次未观察到公式节点，未给出翻译后几何结论。
- YouTube 后续预检因自动化上下文关闭未运行成功；未验真实 ASR cue 或拖拽菜单。
- Reddit／Telegram／Discord 登录编辑器草稿、输入 value 动作、React19 同结构重写、特定 iframe 组合、动态包裹及 body 替换，仍只有先前受控证据或未执行。普通站点访问不能替代这些复现。
- Edge／Firefox 本轮没有运行验证。既有构建结果不能代替浏览器验收。

## 证据限制与清理

本轮前段 CDP helper 引用了旧 REPL context，未形成当前国内测试轮的内容脚本归属记录。后续 REPL 重置又丢失内存中的逐请求 journal；旧 flush helper 没有将当前轮 journal 写到本目录。因此此处 JSON 明确是**已返回的脱敏观察结果**与截图汇总，不伪装为完整原始网络日志，177／10 为实际采样计数输出。原国内生产中止记录和海外中止 `result.json` 保留，不改写为当前轮通过记录。

论文首次断言将双语下原文＋译文共 6 个代码节点错误地与原文 3 个比较，且将包含译文的 textContent 与原文整体比较；现场截图显示原文／译文均有 3 个 `invoke`。随后使用脱离页面的 clone 删除译文 wrapper，比对原文精确相同，并分别比对原文与译文代码，均通过。记录此测试断言错误，未修改产品实现。

**本轮不能给出“零上游商业请求”或完整 G5 结论，也不推进完整同步元数据。**

[最终校验与清理记录](2026-10-15T07:19:01.909Z/verification-cleanup.json)：国内生产 `2440c523…`、海外生产 `ea567267…`、本轮国内测试 `841c7a8c…` 三个产物哈希均保持；生产源码 diff 为空。专用浏览器已停止，含真实会话的临时 profile 已删除。没有 push、发布或商店上传。
