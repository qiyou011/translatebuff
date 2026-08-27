## MODIFIED Requirements

### Requirement: 渠道注册表与构建期号码解析

系统 MUST 以单一真源登记每个渠道的 `{号码, 浏览器, edition}`，并在构建期按注入的渠道 id 解析出渠道号。渠道 id 为人类可读键（`zip` / `chrome-store` / `edge` / `firefox` 等）；号码为后端分配的字符串，未分配以 `null` 占位。每个渠道 MUST 归属唯一 edition；渠道 id 在全表内 MUST 唯一，跨 edition 的同名渠道 MUST 以不同 id 区分。默认渠道 MUST 按 edition 取该线的官网直装渠道。

#### Scenario: [API层] 未注入渠道 id 时回落默认渠道

- **GIVEN** 构建期未设置 `WXT_FORK_CHANNEL`
- **WHEN** 调用 `resolveChannelNumber()`
- **THEN** MUST 返回当前 edition 默认渠道的号码
- **AND** edition 为 `cn` 时 MUST 返回 `"7100"`，与本变更前一致

#### Scenario: [API层] 命中已登记渠道返回其号码

- **GIVEN** 渠道 id `zip` 在注册表中且号码为 `"7100"`
- **WHEN** 以 `resolveChannelNumber("zip")` 解析
- **THEN** MUST 返回 `"7100"`

#### Scenario: [API层] 未知渠道 id 即时抛错

- **GIVEN** 渠道 id `"unknown-store"` 不在注册表中
- **WHEN** 以该 id 解析
- **THEN** MUST 抛错，且错误信息 MUST 列出可选渠道 id 清单

#### Scenario: [API层] 号码未分配（null）即时抛错

- **GIVEN** 某渠道已登记但号码为 `null`（新增渠道待后端分配号码的过渡态）
- **WHEN** 以该 id 解析
- **THEN** MUST 抛错并指明该渠道号码未分配，不得返回空串或占位值

#### Scenario: [API层] 渠道与 edition 不匹配即时抛错

- **GIVEN** 当前 edition 为 `global`，渠道 id 归属 `cn`
- **WHEN** 以该 id 解析
- **THEN** MUST 抛错并指明该渠道不属于当前 edition
- **AND** MUST NOT 返回该渠道号码

#### Scenario: [API层] 海外渠道齐备

- **GIVEN** edition 为 `global`
- **WHEN** 枚举该 edition 下的渠道
- **THEN** MUST 至少含官网直装、Chrome Web Store、Edge、Firefox 四个渠道
- **AND** 每个渠道 MUST 登记其构建目标浏览器

#### Scenario: [API层] 渠道号 MUST 落在官网 cid 放行段位内

- **GIVEN** 官网按段位放行 `cid`（当前只认 `71` 打头的四位），段外取值静默回落官网直装号
- **WHEN** 为某渠道登记号码
- **THEN** 该号码 MUST 在官网放行段位内，否则插件跳官网带的 `?cid=` 归因 MUST 视为失效
- **AND** 号码超出放行段位时 MUST NOT 直接出正式包——须先改号或先放宽官网段位校验

#### Scenario: [API层] 渠道号格式满足 UA 分段约束

- **GIVEN** 任一已分配号码
- **WHEN** 写入 7 段 UserAgent 第 4 段
- **THEN** 号码 MUST 为四位数字且 MUST NOT 含 `/`，以保证后端按 `/` 切分恒得 7 段

#### Scenario: [API层] 一键全渠道打包按 edition 圈定范围

- **GIVEN** 以某一 edition 执行全渠道打包
- **WHEN** 遍历注册表
- **THEN** MUST 只打该 edition 下的渠道
- **AND** 号码未分配的渠道 MUST 跳过并在汇总中列名，MUST NOT 静默略过
