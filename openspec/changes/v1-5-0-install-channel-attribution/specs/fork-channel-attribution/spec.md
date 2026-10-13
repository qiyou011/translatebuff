## MODIFIED Requirements

### Requirement: UserAgent 携带当前渠道号

国内及海外系统必须（MUST）令 7 段自定义 `Useragent` 第 4 段采用本次读取的当前官网 `aitrans_cid`，没有可用值时采用包内号。系统必须（MUST）在实际会员与 report 请求入口异步读取渠道并显式构造请求头；各段必须不含 `/`，保证恒为 7 段。

#### Scenario: 当前 Cookie 为 9899

- **当** 海外 Edge 包内号为 `7152`，当前 Cookie 为 `9899`，发送会员或 report 请求
- **则** UA 第 4 段必须为 `9899`，第 6 段仍为发布版本

#### Scenario: [API层] 默认构建 UA 段4 为 7100

- **当** 国内构建未注入渠道 id，当前官网没有可用 Cookie
- **则** UA 第 4 段必须为默认包内号 `7100`

#### Scenario: [API层] 指定渠道构建 UA 段4 为该渠道号

- **当** 国内构建渠道为 `chrome-store`，当前官网没有可用 Cookie
- **则** UA 第 4 段必须为 `7101`

#### Scenario: Cookie 更新和清除

- **当** 海外 Edge Cookie 从 `9899` 变成 `66666` 后清除
- **则** 后续请求 UA 第 4 段必须依次为 `9899`、`66666`、`7152`

### Requirement: 官网跳转链接携带 cid 归因参数

系统必须（MUST）在登录及订单／支付的官网链接构造时读取当前 Cookie 优先渠道并追加 `cid`。海外卸载问卷必须在设置 URL 时使用同一渠道来源；国内指定表单继续使用原链接。追加必须（MUST）保留既有 query 和 fragment；回跳只使用 `cid`，不创建安装推广记录。

#### Scenario: [UI层] 登录跳转追加 cid

- **当** 用户触发登录跳转，当前 Cookie 为 `9899`
- **则** 打开的官网 URL 必须含 `cid=9899`

#### Scenario: [UI层] 订单跳转追加 cid

- **当** 用户触发订单／支付跳转，当前 Cookie 为 `9899`
- **则** 打开的官网 URL 必须含 `cid=9899`

#### Scenario: [UI层] 卸载问卷跳转追加 cid

- **当** 海外插件设置官网卸载问卷 URL，当前 Cookie 为 `9899`
- **则** URL 必须含 `cid=9899`；国内指定表单沿用原链接

#### Scenario: 海外卸载问卷设置渠道

- **当** 海外插件设置卸载问卷 URL，当前 Cookie 为 `9899`
- **则** 注册 URL 必须含 `cid=9899`；重新设置时必须重新读取，已设置 URL 不承诺随 Cookie 自动更新

#### Scenario: [API层] 目标 URL 已含 query 时正确合并

- **当** 目标 URL 为 `https://www.translatebuff.com/login?lang=en#section`，当前渠道为 `9899`
- **则** 必须保留 `lang=en` 和 `#section`，正确合并 `cid=9899`，不得产生第二个 `?`

## ADDED Requirements

### Requirement: UserAgent 携带插件发布版本

国内及海外插件必须（MUST）令 7 段自定义 `Useragent` 的第 6 段取自 `src/fork/identity/fork-version.json`，并通过 `readForkVersion()` 与 manifest `version`、启动事件 `client_version` 共用发布版本来源。会员与登录、匿名 report 请求必须（MUST）使用同一版本，不得硬编码旧版本或使用上游 `package.json` 版本。本次发布配置必须（MUST）为 `1.5.0`；后续发版随该配置更新。

#### Scenario: 1.5.0 发布版本一致

- **当** 发布配置为 `1.5.0`，重新构建插件并发送会员或 report 请求
- **则** manifest、启动事件版本和 UA 第 6 段必须均为 `1.5.0`，Cookie 仅影响第 4 段

#### Scenario: 登录与匿名埋点版本一致

- **当** 同一构建发送登录和匿名 report 请求
- **则** 两者的 UA 第 6 段必须与会员请求及发布配置一致

#### Scenario: 分支名不替代发布配置

- **当** 分支为 `feat/1.5.0`，但发布配置仍为其他版本
- **则** manifest 和请求 UA 必须使用配置版本，发布前必须更新配置并重新构建
