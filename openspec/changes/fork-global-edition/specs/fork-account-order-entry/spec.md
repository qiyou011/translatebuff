## MODIFIED Requirements

### Requirement: 官网跳转按 UI 语言带多语言前缀 [API层]

打开官网订单页的 URL 路径 MUST 按插件界面语言带官网 next-intl 多语言前缀，规则与会员登录跳转一致（复用同一 locale 前缀逻辑）。官网 `localePrefix: as-needed`、`defaultLocale: en`。订单页的**基础路径** MUST 按当前 edition 解析：国内线为 `/orders`，海外线为 `/account/orders`；locale 前缀 MUST 拼在基础路径之前。

#### Scenario: 简体中文 UI → zh-hans 前缀

- **GIVEN** 插件 UI 语言为简体中文且 edition 为 `cn`
- **THEN** 订单路径 MUST 为 `/zh-hans/orders`（官网 locale 全码，MUST NOT 为 `/zh/orders`）

#### Scenario: 英文 UI → 无前缀

- **GIVEN** UI 语言为英文（官网默认 locale）且 edition 为 `cn`
- **THEN** 订单路径 MUST 为 `/orders`（as-needed，无前缀）

#### Scenario: 其余已映射语言带对应前缀

- **GIVEN** UI 语言为 zh-TW / ja / ko / es / ru / tr 之一且 edition 为 `cn`
- **THEN** 路径 MUST 带对应官网 locale 前缀（`zh-hant` / `ja` / `ko` / `es` / `ru` / `tr`）+ `/orders`

#### Scenario: 未映射语言回退默认

- **GIVEN** UI 语言未在官网 locale 映射表内（如 vi）
- **THEN** MUST 回退该 edition 的无前缀订单路径，MUST NOT 拼出不存在前缀导致 404

#### Scenario: 登录路径泛化后行为不回归

- **GIVEN** `websiteLoginPath(locale)` 泛化为 `websiteLocalePath(locale, path)`
- **WHEN** 以 `websiteLocalePath(locale, "/login")` 生成登录路径
- **THEN** 对任意 locale，结果 MUST 与泛化前 `websiteLoginPath(locale)` 完全一致

#### Scenario: 海外线订单路径落在账户中心下

- **GIVEN** edition 为 `global` 且 UI 语言为英文
- **WHEN** 解析订单路径
- **THEN** MUST 为 `/account/orders`

#### Scenario: 海外线订单路径的 locale 前缀在最前

- **GIVEN** edition 为 `global` 且 UI 语言为简体中文
- **WHEN** 解析订单路径
- **THEN** MUST 为 `/zh-hans/account/orders`
- **AND** MUST NOT 为 `/account/zh-hans/orders`

#### Scenario: 国内线订单路径不受本变更影响

- **GIVEN** edition 为 `cn`
- **WHEN** 对映射表内任一 locale 解析订单路径
- **THEN** 结果 MUST 与本变更前逐字一致
