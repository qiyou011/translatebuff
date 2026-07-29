# fork-channel-attribution Specification

## Purpose

TBD - created by archiving change fork-multi-channel-attribution. Update Purpose after archive.

## Requirements

### Requirement: 渠道注册表与构建期号码解析

系统 MUST 以单一真源登记每个渠道的 `{号码, 浏览器}`，并在构建期按注入的渠道 id 解析出渠道号。渠道 id 为人类可读键（`zip` / `chrome-store` / `edge` / `firefox`）；号码为后端分配的字符串，未分配以 `null` 占位。默认渠道 MUST 为 `zip`（号码 `7100`）。

#### Scenario: [API层] 未注入渠道 id 时回落默认渠道

- **GIVEN** 构建期未设置 `WXT_FORK_CHANNEL`
- **WHEN** 调用 `resolveChannelNumber()`
- **THEN** MUST 返回默认渠道 `zip` 的号码 `"7100"`

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

### Requirement: UserAgent 携带当前渠道号

系统 MUST 令 7 段 UserAgent 的第 4 段（渠道段）取自渠道号解析结果，而非硬编码常量。UA 各段 MUST 不含 `/`，保证后端按 `/` split 恒得 7 段。

#### Scenario: [API层] 默认构建 UA 段4 为 7100

- **GIVEN** 构建期未注入渠道 id
- **WHEN** 装配鉴权请求头并读取 `Useragent`
- **THEN** 按 `/` 切分 MUST 恰得 7 段，且第 4 段 MUST 为 `"7100"`

#### Scenario: [API层] 指定渠道构建 UA 段4 为该渠道号

- **GIVEN** 构建期注入 `WXT_FORK_CHANNEL=chrome-store`（号码 `7101`）
- **WHEN** 装配鉴权请求头并读取 `Useragent`
- **THEN** UA 第 4 段 MUST 为 `7101`（随渠道变，不再恒为 `7100`）

### Requirement: 官网跳转链接携带 cid 归因参数

系统 MUST 在扩展跳转官网的归因相关链接上追加 `?cid=<渠道号>` 查询参数，取值 MUST 与 UA 第 4 段同源（同一渠道号解析结果）。覆盖范围 MUST 包含登录跳转、订单/支付跳转、卸载问卷跳转三处出站官网链接（登录/卸载归因获客、订单归因转化）。追加 MUST 用稳健方式处理链接已有 query / fragment 的情形。

#### Scenario: [UI层] 登录跳转追加 cid

- **GIVEN** 当前构建渠道号解析为 `7100`
- **WHEN** 用户在扩展内触发"登录"、扩展打开官网登录页
- **THEN** 打开的 URL MUST 含 `cid=7100` 查询参数，且 cid 值 MUST 等于同构建的 UA 第 4 段

#### Scenario: [UI层] 订单跳转追加 cid

- **GIVEN** 当前构建渠道号解析为 `7100`
- **WHEN** 用户在扩展内触发"订单"、扩展打开官网订单/支付页
- **THEN** 打开的 URL MUST 含 `cid=7100` 查询参数，供官网按渠道归因转化/支付

#### Scenario: [UI层] 卸载问卷跳转追加 cid

- **GIVEN** 当前构建渠道号解析为 `7100`
- **WHEN** 扩展设置卸载后跳转的官网问卷 URL
- **THEN** 该 URL MUST 含 `cid=7100` 查询参数

#### Scenario: [API层] 目标 URL 已含 query 时正确合并

- **GIVEN** 目标官网 URL 已含既有查询参数（如 `?lang=zh`）
- **WHEN** 追加 cid
- **THEN** MUST 以 `&` 合并为 `?lang=zh&cid=<号码>`，不得产生第二个 `?` 或覆盖既有参数

### Requirement: 按渠道产出正式包的打包管线

打包脚本 MUST 支持"单渠道补打"与"一键全渠道正式包"。正式包（store 模式）MUST 强制显式指定渠道，产物文件名 MUST 按渠道 id 命名以避免同浏览器双渠道相互覆盖。渠道对应的浏览器构建目标 MUST 从注册表推导，不由使用者手填。

#### Scenario: [构建层] 单渠道正式包产物名含渠道 id

- **GIVEN** 执行 `node scripts/pack.mjs store --channel chrome-store` 且该渠道已分配号码
- **WHEN** 打包完成
- **THEN** MUST 从注册表推导浏览器为 `chrome` 并执行对应构建
- **AND** 产物文件名 MUST 形如 `translatebuff-<版本>-chrome-store.zip`（以渠道 id 为后缀）
- **AND** MUST 依次通过 `assert-fork-build` 与 `check-fork-brand` 校验

#### Scenario: [构建层] 同浏览器双渠道产物名不撞车

- **GIVEN** `zip` 与 `chrome-store` 均为 `chrome` 构建
- **WHEN** 分别打包
- **THEN** 两产物文件名 MUST 分别为 `...-zip.zip` 与 `...-chrome-store.zip`，MUST NOT 互相覆盖

#### Scenario: [构建层] 一键全渠道遇未分配号码跳过续跑

- **GIVEN** 执行 `node scripts/pack.mjs store --all`，注册表中部分渠道已分配号码、部分渠道号码为 `null`（新增待分配渠道）
- **WHEN** 遍历各渠道打包
- **THEN** 已分配号码的渠道 MUST 正常打包并断言
- **AND** 号码为 `null` 的渠道 MUST 打印跳过提示并继续下一个，不得中断整批
- **AND** 结尾 MUST 汇总"已出"与"已跳过（号码未分配）"清单
- **AND** 仅当真实构建或断言失败时才 MUST fail-fast 中断

#### Scenario: [构建层] 裸 store 打包强制显式渠道

- **GIVEN** 执行 `node scripts/pack.mjs store` 未带 `--channel` 或 `--all`
- **WHEN** 脚本启动
- **THEN** MUST 报错退出并提示必须显式指定渠道（官网包亦须 `--channel zip`），MUST NOT 沉默回落 `7100`

#### Scenario: [构建层] 指定未分配号码渠道单独打包硬报错

- **GIVEN** 执行 `--channel <某渠道>` 但该渠道号码为 `null`
- **WHEN** 脚本解析该渠道
- **THEN** MUST 硬报错退出，不得产出任何包

#### Scenario: [构建层] 构建期拦截号码未分配的产物

- **GIVEN** 绕过打包脚本、直接以 `WXT_FORK_CHANNEL=<号码为null的渠道id>` 触发构建
- **WHEN** 产物构建断言执行
- **THEN** 构建 MUST 在**构建期**失败（把运行期首个请求才崩的问题前移），MUST NOT 产出一个运行期才崩溃的包

#### Scenario: [构建层] dev 裸打包行为不变

- **GIVEN** 开发态执行 `pnpm zip`（未注入 `WXT_FORK_CHANNEL`）
- **WHEN** 打包完成
- **THEN** 渠道号 MUST 回落 `7100`
- **AND** 产物文件名 MUST 保持既有 `-{{browser}}.zip` 命名，不受渠道命名改造影响
