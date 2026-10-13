## Why

接口请求渠道应优先使用浏览器中当前官网的 `aitrans_cid`，没有可用值时使用渠道包内号码。原方案读取安装推广记录并固定结果，导致官网 Cookie 已为 `9899` 时插件仍发送包内 `7152` 或旧固定号。

2026-10-13 用户明确修订：取消“选定后固定，后续 Cookie 变化不改号”，国内与海外均按当前 Cookie 优先。本地工件以本次确认作为验收依据；原 Gitee 提案中的安装冻结规则已被该决定替代，远端需求仓尚未同步。

本次发布版本为 `1.5.0`，manifest、UA 和启动事件共用发布配置。

## What Changes

- 每次会员请求、report 请求及登录／订单官网跳转读取当前环境官网的 `aitrans_cid`，有可用值则使用，无值、空值、不可读或超时则使用包内渠道。
- Cookie 更新影响后续请求；Cookie 清除后直接回到包内号。国内及海外、新装、冷启动、升级均遵循同一规则。
- 取消 `aitrans_install_promo`、推广白名单、30 天安装判断和扩展安装渠道快照的消费；旧 `fork_install_channel_v1` 不再参与决策。
- 自定义 `Useragent` 第 4 段与启动事件 `launch_channel_id` 使用当前渠道；同一次启动上报的请求体和请求头共用一次读取结果。
- 海外启动及活跃事件 `origin_cid` 始终保留包内原生号；现有事件、去重及账号注册归因规则不变。
- 国内及海外 UA 第 6 段、manifest 和启动事件 `client_version` 共用 `readForkVersion()`，本次为 `1.5.0`。
- 海外卸载问卷在设置 URL 时读取当前渠道；国内指定表单链接沿用原规则。

## Capabilities

### New Capabilities

- `fork-install-channel-selection`: 国内及海外每次读取当前官网 Cookie 并回落包内渠道；保留能力标识以延续本变更，但不再保存安装时选择。

### Modified Capabilities

- `fork-channel-attribution`: 请求 UA 和官网跳转使用当前渠道，保留包内原生号及发布版本来源。

## Impact

- 涉及渠道运行时、后台消息、会员请求、report、启动上报及官网登录／订单／海外卸载链接。
- 复用既有 Cookie 权限、官网 host 权限和 `POST /api/data_report/v1/client/click_event`，不新增依赖或后端 API。
- 每次请求增加一次 Cookie 读取；读取超过 1500 毫秒按包内号放行。后续请求重新尝试读取。
