## Context

海外插件当前从包配置解析 `7150`—`7153`，由 `src/fork/identity/channel.ts` 提供给自定义请求头和官网回跳。`src/fork/background/index.ts` 当前先启动会员同步，随后才设置安装启动上报，因此新安装时可能在读取推广证据前发出请求。官网同名变更把明确推广链接 `?promo_cid=7154` 写为独立的 30 天推广 cookie；普通回跳 `?cid=` 不写该记录。插件要在安装时读取同浏览器配置、同环境官网域的记录，固定一次选择。

需求来源：[Gitee v1.5.0 变更](https://gitee.com/junyun-product/AI/tree/main/translatebuff/openspec/changes/v1-5-0-install-channel-attribution)。本变更无 Figma 链接；不涉及视觉设计。

## Goals / Non-Goals

- Goals：新安装得到一个固定渠道；首批会员请求、report、官网回跳一致使用它；`origin_cid` 保留真实包内号；失败时翻译继续可用。
- Non-Goals：不修改国内包、账号注册归因、报告事件触发和去重、不新增上报 API，也不跨设备或浏览器配置同步推广记录。

## Decisions

### D1. 后台统一持有异步渠道决策

保留 `resolveChannelNumber()` 作为包内原生号来源。新增海外安装渠道决策模块，后台初始化时先建立并暴露单一决策 Promise，注册 `runtime.onInstalled` 处理和供 popup/options 读取的消息，再启动可能发请求的会员同步及启动上报。安装事件回调入口必须先同步捕获 `installAt=Date.now()`，再读取 cookie 或存储；不能在异步步骤后取时间。`src/fork/background/index.ts` 中现有 `setupMembership()` 先于 `setupStartUpTracking()` 的顺序需要调整。

安装事件和普通冷启动走同一状态入口。新安装只允许安装事件读取推广证据；普通冷启动从已保存结果或包内号完成，不得无限等待安装事件。会员、report 和跳转调用共享这个 Promise；不得各自临时解析或先用暂定包内号。实施时用集成测试覆盖安装事件与首发请求并发，验证背景初始化顺序在 Chrome、Edge、Firefox 目标构建中成立；若浏览器事件时序无法保证，则必须先调整启动握手，不能靠任意延时碰运气。

### D2. 只读取同环境官网的明确推广记录

用现有 `cookies` 和官网 host 权限读取 `browser.cookies.get({ url: WXT_WEBSITE_URL, name: 'aitrans_install_promo' })`。`WXT_WEBSITE_URL` 生产指向 `https://www.translatebuff.com`，测试指向 `https://test.translatebuff.com`；浏览器 cookie 容器和配置天然隔离。官网用 `js-cookie` 写入 JSON，浏览器 cookies API 返回 URL 编码的原始值，插件需先解码再解析约定的 `{cid, recordedAt}`；本期只有 `cid === '7154'` 可选。条件是 `recordedAt < installAt` 且 `installAt - recordedAt < 30 * 24 * 60 * 60 * 1000`。时间缺失、不为有限整数、等于安装时刻、恰满 30 天、未来时间或格式错误均无效。不要从 `aitrans_cid`、URL `cid` 或其他 `71xx` 推断安装推广。用户未提供适用的隐私同意或 cookie 不可读时选包内号。

### D3. 固定选择并按状态处理存储失败

扩展本地存储保存版本化记录，例如 `{ installAt, selectedCid, websiteOrigin }`。选定后同一次后台运行始终使用内存中的结果；写入失败时保留该结果并重试写入，不能在随后请求中改变号。进程重启后若确实没有固定记录，按包内号恢复，不再次读取后来写入的网站推广。`update` 事件且无固定记录的旧用户也固定为包内号，不补历史归因。读取本地存储失败或超时时，本次进程稳定使用包内号；不得覆盖可能存在但暂不可读的旧记录。卸载重装是新的 `install` 事件，可以重新选择；这只表示新安装事件，不代表新增真实用户。

### D4. 所有渠道出口使用同一个结果

将当前同步的 `buildAuthHeaders()` 改为在异步请求入口取得固定渠道后，以显式渠道参数组装 7 段 `Useragent`；其他调用方不能绕开此入口。复用 `src/fork/analytics/report-client.ts` 中现有 `POST /api/data_report/v1/client/click_event`。启动事件 `action_extra_info.launch_channel_id` 使用固定号；启动和活跃事件都增加整数 `origin_cid`，始终取包内号，不额外上报时间戳。原事件名、触发、去重和注册归因不变。

登录、订单／支付及卸载问卷官网 URL 在构造前读取固定号，将它作为 `cid` 传入现有 URL 合并逻辑；不得写 `promo_cid`。URL 已有 query 或 fragment 时继续正确合并。插件固定为 `7154` 后，三处回跳和请求头均为 `7154`，官网仅按普通 `cid` 更新当前请求归因，不刷新安装推广记录。

### D5. 部署与联调顺序

先实施并部署海外官网同名变更，使 `promo_cid` 能写独立 cookie，再实施插件读取；两边使用同一 cookie 名、JSON 形状、时钟单位和 30 天边界。联调须分别覆盖官网与插件生产域、测试域，四种海外包内号，以及安装前后和失效边界。`origin_cid` 作为 report 事件扩展属性发送；后端入库映射不属于本变更范围。

## Risks / Trade-offs

- 浏览器安装事件、后台启动与首发请求并发。统一决策门禁和安装事件测试承担这一风险；不能让会员同步先起。
- 网站 cookie 的隐私同意、浏览器权限或容器隔离可能导致读取失败。按包内号兜底，仍保持请求与翻译功能。
- 首次写扩展存储失败后，后台进程消失会丢失推广选择。重启后按包内号，不重新消费已变化的网站记录，避免错误追溯。
- `origin_cid` 随 report 请求发送；联调核对实际请求体，不擅自改变现有事件协议。

## Open Questions

- 当前网站隐私同意机制在生产与测试域分别如何限制推广 cookie？实施前核对，未获适用同意时不读取为有效推广。
