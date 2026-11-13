# 重新确定的验收基线

用户于 2026-11-13 明确要求“并重新确定原站验收基线”。据此采用以下两个独立基线；不继续依赖已失效的 localhost:18843 或缺失的历史测试台。

## 受控原型基线

- 输入：用户提供的评审原型，SHA-256 为 `7d4167fd456ecec9c27db86b277fa0269854c8ff9b737e0a0725c7287b35cdf1`。
- `format-fixtures.json` 保留全部 27 组 source、fixtureCss、要求和观察项；没有把 target 或 observed 作为预置译文。
- `format-fixture.html` 原样承载 source 和 fixtureCss，补充按钮计数与动态新增事件。通过 HTTP 服务加载后使用实际构建扩展翻译。
- `baseline-fixture.test.ts` 验证全部源样例一致、无预置译文，以及点击计数与动态追加单次行为。2 项测试通过。
- F24 保留历史首段逐字复制。它是历史内容对照，不能再要求当前官网仍包含该句。

## 当前原站基线

- 官方项目链接指向的原站：`https://iphone-use.leeguoo.com/en/`。
- 采集时间：2026-11-13 14:37:26（Asia/Shanghai）；HTTP 200，最终 URL 相同。
- 原始 HTML：`original-site-20261113.html`；SHA-256：`644b4733ecba9969bb91f27105403c87c793ba9e42d880f3c526927ffc5af7e5`。
- 结构及原文：`original-site-baseline.json`。LIVE-1 为 `p.du-lede`，含一个 `.mark` 高亮和一个 `strong`，当前首段不含代码。另保存实际站点 CSS 到 `original-site-docs-20261113.css`，哈希和采集时间在 JSON 中。
- 高亮对应 “Let AI agents use your real iPhone.”，粗体对应 “including the ones with no API”。翻译后分别检查含义对应、范围和背景，不按译文字符偏移推测。
- 当前首段与原型历史文案不同，线上首段不承担代码保护的验证；代码由 F01/F06/F24 等受控案例验证。

| 编号   | 在线定位                                                       | 核对目标                                   |
| ------ | -------------------------------------------------------------- | ------------------------------------------ |
| LIVE-1 | `p.du-lede`                                                    | 当前首段高亮、粗体范围与正文完整性         |
| LIVE-2 | `h2`，文字为 Connect your agent in three steps                 | 标题层级、标题与正文的字体区别、缺字回退   |
| LIVE-3 | 含 iphone-use doctor 的 `pre`                                  | 两行代码字符、空格及换行原样，不替换原节点 |
| LIVE-4 | 含 Scripts and other agents can call the HTTP API under 的 `p` | 正文翻译、`/agent/*` 原样与位置            |
| LIVE-5 | `a.du-nav-item[href="/en/install"]`                            | 原导航链接身份、目标和图标保留             |
| LIVE-6 | `button.du-copy-page`                                          | 复制按钮身份、事件及功能保留，无重复控件   |

## 通过标准和复测记录

谷歌与微软分别运行受控 F01—F27 和在线 LIVE-1—LIVE-6。原型主验收方向为英语到简体中文；其他方向的实验失败仍须保留，不能据主方向通过宣称所有语言已通过。记录构建、浏览器、服务、语言方向、模式、字色、缓存冷/热状态、原文快照、译文 DOM、截图以及 normal/degraded/failed。降级不得计为正常 P0 通过。

线上额外检查标题/正文/代码字体差异、原链接、恢复原文、重复翻译、服务切换和单段唯一性。F22/F23 检查原节点身份、点击计数、勾选、折叠与动态追加。站点文案变化先保存新快照并记录差异，不能覆盖本次原始证据或将差异直接判为插件回归。

该文档确定输入和判据，尚未证明构建扩展在浏览器中通过。验收矩阵保持待验证，直至实际测试留证。
