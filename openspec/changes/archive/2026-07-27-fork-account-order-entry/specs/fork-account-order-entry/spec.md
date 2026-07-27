## ADDED Requirements

### Requirement: 会员信息从 tokens 主档派生 [API层]

会员信息 MUST 从 `/v1/tokens` 的 tokens 数组**主档**（`priority` 最高的单条 token）派生，MUST NOT 跨 token 累加。判定逻辑 MUST 复刻官网 `deriveTier`：会员类型由**前端推断**（不读后端 `tier` 字段）——主档 `token_name==='subscription'` 且未过期 → pro，否则 free。派生纯函数 MUST 有就近黄金用例测试锁定语义。

#### Scenario: 主档选取（priority 最高，缺失取靠前）

- **GIVEN** tokens 数组多条，priority 分别为 [1, 5, 3]
- **WHEN** 选主档
- **THEN** MUST 取 priority=5 的那条
- **AND** priority 缺失的 token MUST 按最低优先级处理；全部缺失时 MUST 取数组靠前一条

#### Scenario: PRO 判定（订阅主档且未过期）

- **GIVEN** 主档 `token_name==='subscription'` 且 `expired_time > 当前秒`（或 `expired_time===-1` 永不过期）
- **WHEN** 派生会员类型
- **THEN** 结果 MUST 为 `pro`

#### Scenario: FREE 判定（非订阅 / 已过期 / 无主档）

- **WHEN** 主档 `token_name !== 'subscription'`，或订阅主档 `expired_time` 已过期，或 tokens 为空/非数组（无主档）
- **THEN** 结果 MUST 为 `free`

#### Scenario: 到期时间取 final_expire_at 日期部分

- **GIVEN** 主档 `final_expire_at === "2027-07-24 18:34:03"`
- **WHEN** 派生到期时间
- **THEN** MUST 为 `"2027-07-24"`（空格切分取日期）；`final_expire_at` 缺失时 MUST 为 null（面板隐藏到期行）

#### Scenario: 用量取主档 remain_quota / total_quota

- **WHEN** 派生用量
- **THEN** 剩余 MUST 取主档 `remain_quota`、总量取 `total_quota`；缺失记 0，MUST NOT 累加其它 token

### Requirement: 会员信息独立存储、实时刷新与登出清态 [API层]

会员信息 MUST 存独立的 `forkMembershipInfo` 键/atom，MUST NOT 塞进 `ForkSession`（登录身份快照，用量动态存快照会陈旧）。popup 打开 MUST 触发一次 tokens 重拉并重派生写入。登出/清会话 MUST 显式清除 `forkMembershipInfo`。

#### Scenario: popup 打开刷新用量

- **WHEN** 用户打开 popup 账户面板
- **THEN** MUST 触发 background 重拉一次 tokens → 重派生 → 写 `forkMembershipInfo`
- **AND** MUST NOT 引入轮询/定时器

#### Scenario: 登出清除会员信息（无幽灵态）

- **WHEN** 用户登出（`clearMembership`）
- **THEN** MUST 显式 removeItem `forkMembershipInfo`
- **AND** 登出后再看账户面板 MUST NOT 残留上一用户的 PRO 徽章 / 用量

#### Scenario: fetchTokens 加性扩展不破坏既有消费

- **GIVEN** `fetchTokens` 返回被 `fetchTokensWithRetry` / `adoptCredential` / `ensureMembershipKey` 消费
- **WHEN** 扩展 fetchTokens 以携带完整 tokens 供派生
- **THEN** MUST 仅追加字段，MUST NOT 改变既有 `skKey` / `baseUrl` 形状

### Requirement: 账户面板会员信息展示 [UI层]

popup 与侧边栏账户面板 MUST 简洁展示会员信息：手机号旁一个「免费 / PRO」徽章；PRO 用户 MUST 额外显示到期时间与剩余用量（一行文字）；免费用户 MUST 只显示「免费」徽章，MUST NOT 展示到期/用量/升级引导。MUST NOT 照抄官网大号百分比 + 进度条。两壳 JSX 不共享，MUST 各自展示。

#### Scenario: PRO 用户显示徽章 + 到期 + 用量

- **GIVEN** 已登录且会员类型为 pro
- **WHEN** 打开 popup 或侧边栏账户面板
- **THEN** MUST 显示「PRO」徽章
- **AND** MUST 显示到期时间与剩余 token 用量（简洁一行）

#### Scenario: 免费用户只显示徽章

- **GIVEN** 已登录且会员类型为 free
- **WHEN** 打开账户面板
- **THEN** MUST 只显示「免费」徽章
- **AND** MUST NOT 显示到期 / 用量 / 升级引导

#### Scenario: 未登录不显示会员信息

- **GIVEN** 用户未登录
- **THEN** MUST NOT 渲染任何会员信息（仅显示「登录」按钮）

### Requirement: 账户面板「我的订单」入口 [UI层]

popup 与侧边栏的登录态账户面板，MUST 在「登出」项之前渲染「我的订单」项；点击 MUST 用 `browser.tabs.create` 打开官网订单页。两壳 JSX 不共享，MUST 各自渲染。

#### Scenario: 登录态两壳均渲染订单项且位于登出之前

- **GIVEN** 用户已会员登录
- **WHEN** 打开 popup 或侧边栏账户面板
- **THEN** MUST 渲染「我的订单」项，且位于「登出」项之前

#### Scenario: 未登录态不渲染订单项

- **GIVEN** 用户未登录
- **THEN** MUST NOT 渲染「我的订单」

#### Scenario: 点击在新标签页打开官网订单页

- **WHEN** 点击「我的订单」
- **THEN** MUST 用 `browser.tabs.create` 打开订单 URL
- **AND** URL MUST 由 `env.WXT_WEBSITE_URL` 直接拼接，MUST NOT 用 `getWebsiteUrl`（其 localhost 走 hash 路由到不了官网页面）

### Requirement: 官网跳转按 UI 语言带多语言前缀 [API层]

打开官网订单页的 URL 路径 MUST 按插件界面语言带官网 next-intl 多语言前缀，规则与会员登录跳转一致（复用同一 locale 前缀逻辑）。官网 `localePrefix: as-needed`、`defaultLocale: en`。

#### Scenario: 简体中文 UI → zh-hans 前缀

- **GIVEN** 插件 UI 语言为简体中文
- **THEN** 订单路径 MUST 为 `/zh-hans/orders`（官网 locale 全码，MUST NOT 为 `/zh/orders`）

#### Scenario: 英文 UI → 无前缀

- **GIVEN** UI 语言为英文（官网默认 locale）
- **THEN** 订单路径 MUST 为 `/orders`（as-needed，无前缀）

#### Scenario: 其余已映射语言带对应前缀

- **GIVEN** UI 语言为 zh-TW / ja / ko / es / ru / tr 之一
- **THEN** 路径 MUST 带对应官网 locale 前缀（`zh-hant` / `ja` / `ko` / `es` / `ru` / `tr`）+ `/orders`

#### Scenario: 未映射语言回退默认

- **GIVEN** UI 语言未在官网 locale 映射表内（如 vi）
- **THEN** MUST 回退默认路径 `/orders`（无前缀），MUST NOT 拼出不存在前缀导致 404

#### Scenario: 登录路径泛化后行为不回归

- **GIVEN** `websiteLoginPath(locale)` 泛化为 `websiteLocalePath(locale, path)`
- **WHEN** 以 `websiteLocalePath(locale, "/login")` 生成登录路径
- **THEN** 对任意 locale，结果 MUST 与泛化前 `websiteLoginPath(locale)` 完全一致
