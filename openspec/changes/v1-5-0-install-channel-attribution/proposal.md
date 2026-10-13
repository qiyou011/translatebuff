## Why

海外插件目前所有渠道请求与官网回跳均取包内号码，无法把用户安装前在官网留下的有效推广来源固定为安装渠道。需要在新安装时一次性选择渠道，同时保留包内原生号，避免后续推广或更新改写历史安装结果。

本地构建包联测发现，自定义 `Useragent` 第 6 段仍硬编码为 `1.0.1`，与插件发布版本不一致；`feat/1.5.0` 分支的发布配置也仍为 `1.4.1`。本次发布版本已确认应为 `1.5.0`，需要统一 manifest、请求头和启动上报的版本来源。

## What Changes

- 新安装时读取同一浏览器配置、同一环境官网的推广记录；仅严格早于安装且不足 30 天的有效记录覆盖包内渠道。无可用记录时取包内号。
- 安装时的选择固定保存；存量升级不补归因，重启与后续广告不重新选择。读取、权限或存储失败按已确认的包内号兜底，并保持正常翻译可用。
- 插件自定义 `Useragent` 第 4 段、启动事件 `launch_channel_id`、登录／订单／卸载回跳 `cid` 使用同一固定号；`origin_cid` 始终保留包内原生号。
- 国内及海外包的自定义 `Useragent` 第 6 段通过 `readForkVersion()` 读取 `src/fork/identity/fork-version.json`，与 manifest 版本及启动事件 `client_version` 同源；本次发布版本统一为 `1.5.0`。
- 复用现有 `report` 的 `click_event` 通道，在启动与活跃事件扩展属性中增加 `origin_cid`；不新增事件，不改变触发、去重或账号注册归因。
- 安装渠道选择仅覆盖海外包 `7150`—`7153`；普通 `aitrans_cid` 不参与该选择，只有认可的安装推广记录可覆盖包内号。官网推广记录及当次请求由 `D:\project\translatebuff-official-website-overseas` 中同名 OpenSpec 变更承接，国内线渠道逻辑不变。

## Capabilities

### New Capabilities

- `fork-install-channel-selection`: 安装时读取、判断并固定推广或包内渠道，以及失效和失败时的兜底。

### Modified Capabilities

- `fork-channel-attribution`: 自定义请求头与官网回跳从包内号改为安装固定号，并保留包内原生号供上报；请求头版本与插件发布版本同源。

## Impact

- 预计涉及 `src/fork/identity/channel.ts`、`src/fork/identity/fork-version.json`、后台安装事件与消息、`src/fork/membership/api.ts`、`src/fork/analytics/`、官网登录／订单／卸载跳转及聚焦测试。
- 复用现有 `cookies`、官网 host 权限、扩展本地存储和 `POST /api/data_report/v1/client/click_event`；不新增依赖或后端接口。本变更只保证 report 请求体携带 `origin_cid`，不涉及后端入库映射。
- 后端注册归因仍按注册时实际使用的渠道判断；安装上报与 `origin_cid` 不覆盖账号注册渠道，历史数据不回填。
