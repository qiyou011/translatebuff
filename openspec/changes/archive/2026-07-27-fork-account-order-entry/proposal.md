## Why

任译喵会员登录后，popup 与选项页侧边栏的账户面板（点用户名弹出的二级菜单）**只有手机号 + 退出登录**：用户既看不到自己的会员信息（类型 / 到期 / 用量），也无法从插件直达官网订单页。本变更把账户面板补全为「会员信息展示 + 我的订单入口」。

## What Changes

- **账户面板补充会员信息**：popup 与侧边栏账户面板**简洁展示**会员类型（免费 / PRO 徽章）、订阅到期时间、token 剩余用量（到期与用量仅 PRO 显示）。数据从官网 `/v1/tokens` 的**主档**（priority 最高的 token）派生，**复刻官网 `deriveTier` 前端推断逻辑**（主档 `token_name==='subscription'` 且未过期 → pro）。用量为动态值，**popup 打开时触发一次重拉**保证实时。
- **账户面板追加「我的订单」入口**：点击按插件 UI 语言打开官网订单页（多语言前缀，与登录跳转一致）。
- **简洁优先**：不照抄官网的大号百分比 + 进度条 + 升级引导，仅一行文字呈现关键信息。
- **【非破坏性】**：纯 fork 层新增，不碰上游引擎、config schema、message.ts。

## Capabilities

### New Capabilities

- `fork-account-order-entry`: 账户面板增强——会员信息展示（类型 / 到期 / 用量，主档派生 + popup 刷新）+ 我的订单入口（按 UI 语言跳官网）。

### Modified Capabilities

<!-- 无。账户面板壳与会员态由既有 fork 会员能力承载，本次在其上补充展示与入口，不改既有登录/登出行为，作为独立新增能力立项。 -->

## Impact

- **影响路径**：
  - fork membership：`api.ts`（fetchTokens 加性扩展、保留完整 tokens）+ 新 `tier.ts`（复刻官网派生逻辑）+ 新 `forkMembershipInfo` 独立 atom/storage 键 + `background/membership.ts`（登录派生 + popup 刷新接线）+ `message.ts`（+1 条 fork 刷新消息）
  - UI：popup `account-menu.tsx` + 侧边栏 `account-menu-sidebar.tsx`（展示会员信息 + 订单项）
  - 路径/文案：`website-locale.ts`（多语言路径泛化）+ i18n（会员 & 订单文案，fork 命名段）
- **软 fork 边界**：全部落在 `src/fork/**`（C 类）与已在 allowlist 的 locale 文件，**零 allowlist 新增**，不碰 A 类引擎。
- **跨仓依赖与对齐**：复刻官网 `translatebuff-web/src/utils/credits.ts` 的 `deriveTier` 等（两仓各一份、无 merge 关系，靠头注释同源 + 黄金用例测试控漂移）；官网 `/orders` 多语言路由与 `/v1/tokens` 字段契约已确认。
- **测试参考（一模块一行）**：
  - tier 派生：主档选取 / free/pro 判定 / 到期切分 / 用量提取 各边界（黄金用例，`-1` 永不过期 · priority 缺失 · 已过期订阅判 free）
  - 会员态接线：fetchTokens 加性不破坏既有消费 · popup 刷新消息 · 登出清 `forkMembershipInfo`（无幽灵态）
  - 多语言路径：`websiteLocalePath` 各 locale + 回退 · 登录泛化不回归
  - 账户面板：两壳均渲染会员信息与订单项 · free 只显徽章 · 订单点击跳对应语言页
