## Context

需求来源：[Gitee v1.5.0 变更](https://gitee.com/junyun-product/AI/tree/main/translatebuff/openspec/changes/v1-5-0-install-channel-attribution)。原提案要求只在安装时读取明确推广记录并固定渠道。2026-10-13 用户明确纠正为“Cookie 中有渠道号就优先使用，没有就用渠道包内的”。本设计按该新规则修订，本地文档不代表远端需求仓已经更新。

现有 `resolveChannelNumber()` 提供包内渠道；会员、report 和官网跳转通过异步渠道入口取得请求渠道。旧实现国内直接取包内号，海外读取固定快照，因此普通 `aitrans_cid=9899` 不会生效。

## Goals / Non-Goals

- Goals：国内、海外都读取当前环境官网 Cookie；改号影响后续请求；清除、空值、失败和超时回落包内号；单次启动上报渠道一致；保留海外 `origin_cid`；版本保持发布配置 `1.5.0`。
- Non-Goals：不修改官网 Cookie 写入规则、账号注册归因或事件触发／去重，不回填历史数据，不跨浏览器配置、设备或环境同步。

## Decisions

### D1. 每次读取当前官网渠道

后台 `getBackgroundInstallChannel()` 每次调用 `browser.cookies.get({url: new URL(WXT_WEBSITE_URL).origin + '/', name: 'aitrans_cid'})`。官网域来自当前包环境配置，国内／海外、测试／生产各自隔离。

非空渠道值优先于包内号，不限制为 `71xx` 或 `7154`；例如 `9899` 和 `66666` 均可使用。为保证 UA 恰为 7 段，含 `/`、空白或控制字符的值视为不可用。不存在或不可用时直接取 `resolveChannelNumber()`。

### D2. 删除安装冻结状态

不缓存选定号，不读写 `fork_install_channel_v1`，不查询 `aitrans_install_promo`，不判断安装时间或 30 天期限。已安装用户升级后也使用当前 Cookie；旧快照可留在存储中，但不能作为缺失 Cookie 时的兜底。

`9899 → 66666 → 删除` 对应后续请求 `9899 → 66666 → 包内号`。插件不另存一份 `9899`；持久值由浏览器官网 Cookie 保存。

### D3. 所有发行版注册后台消息

保留现有 `setupInstallChannel()` 与 `forkGetInstallChannel` 名称，避免改动全部接线。其语义改为读取当前渠道，国内和海外均在后台网络模块启动前注册消息入口，不再注册渠道安装事件。

popup/options 每次请求后台读取；消息失败或 1500 毫秒未返回时，在可访问 Cookie API 的扩展页面尝试直接读取。Cookie 读取失败或超过 1500 毫秒时使用包内号，下一次调用仍重新读取。

### D4. 同一次启动上报只读取一次

会员与普通 report 在请求入口异步读取渠道，再显式传给请求头构造函数。启动上报先读取一次，将结果同时用于 `launch_channel_id` 和 `postClickEvent()` 的可选渠道参数，避免 Cookie 在两次读取间变化造成请求体与 UA 不一致。

海外启动及活跃 `origin_cid` 继续使用包内号。事件名、触发、去重、接口路径和注册归因均沿用原规则。

### D5. 官网跳转的渠道读取时机

登录和订单／支付每次触发时读取当前渠道，构造 URL 的 `cid`。海外卸载问卷在调用 `setUninstallURL()` 时读取当前渠道；已注册 URL 不会因为 Cookie 后续变化自动更新，重新设置时采用最新值。国内卸载仍使用指定表单链接。

URL 用现有合并逻辑保留 query 和 fragment，只追加 `cid`，不写入 `promo_cid`。

### D6. 发布版本共用单一来源

`src/fork/identity/fork-version.json` 是发布版本真源，本次为 `1.5.0`。manifest `version`、自定义 `Useragent` 第 6 段及启动事件 `client_version` 都通过 `readForkVersion()` 取得版本。Cookie 仅影响渠道第 4 段。

## Risks / Trade-offs

- Cookie 改号或清除后，后续请求归因随之改变，这是当前请求渠道规则；包内来源仍由 `origin_cid` 保留。
- 每次读取 Cookie 有异步开销，1500 毫秒超时后用包内号放行；恢复后后续请求重新使用 Cookie。
- 官网页面可能重写 `aitrans_cid`；插件读取浏览器当前值，不推断历史推广来源。
- 官网链接接受的渠道格式由官网仓定义，插件本轮只修复当前 Cookie 优先级；实际跨仓效果需要联调。

## Open Questions

- 使用重新构建的国内及海外包，在实际测试／生产官网域验证 Cookie 读取权限与请求归因；本地测试不替代浏览器及后端联调。
