## 1. 会员派生纯函数 tier.ts（复刻官网）· TDD

- [x] 1.1 写 `src/fork/membership/__tests__/tier.test.ts`（RED），搬官网 `credits.test.ts` 黄金边界断言 `deriveMembershipInfo(tokens)`：① 主档取 priority 最高（缺失取靠前）；② `token_name==='subscription'` 且 `expired_time>now` 或 `=-1` → `tier:"pro"`；③ 非订阅主档 / 已过期订阅 / 空数组 → `tier:"free"`；④ `final_expire_at:"2027-07-24 18:34:03"` → `expiryDate:"2027-07-24"`、缺失 → `null`；⑤ `remainQuota/totalQuota` 取主档 `remain_quota/total_quota`、缺失记 0。
- [x] 1.2 跑 `SKIP_FREE_API=true pnpm run test -- tier` 确认红。
- [x] 1.3 实现 `src/fork/membership/tier.ts`：`RawToken`/`MembershipInfo` 类型 + `pickPrimaryToken` + `deriveMembershipInfo`，逐字复刻官网 `translatebuff-web/src/utils/credits.ts`。**头注释标同源指针**（改官网 credits.ts 须同步本文件）+ 契约常量注释（`SUBSCRIPTION_TOKEN_NAME='subscription'`、`expired_time=-1` 永不过期）。同时复刻官网 `format.ts` 的 `formatCredits`（<1000 原样、K/M）供展示。
- [x] 1.4 跑测试绿；`pnpm run type-check` 0。

## 2. fetchTokens 加性 + 会员信息存储 · TDD

- [x] 2.1 改 `src/fork/membership/__tests__/api.test.ts`（RED）：断言 `fetchTokens` 返回值**追加** `tokens: RawToken[]`（原始数组），且 `skKey`/`baseUrl`/null（skKey 空）语义不变。
- [x] 2.2 跑红。
- [x] 2.3 改 `src/fork/membership/api.ts`：`TokensResult` 加 `tokens` 字段；`fetchTokens` 把已解析的 tokens 数组一并返回（保持 skKey 空→null 逻辑，仅加性）。
- [x] 2.4 新建 `src/fork/membership/membership-info.ts`：`MembershipInfo` 存储层——`membershipInfoAtom`（复刻 `atoms.ts` 的 `forkSessionAtom` storage.watch 范式，独立 storage key）+ `saveMembershipInfo`/`loadMembershipInfo`/`clearMembershipInfo`。
- [x] 2.5 跑测试绿；`type-check` 0。

## 3. background 会员信息接线（登录派生 + 刷新 + 清态）

- [x] 3.1 `src/fork/message.ts`：`ForkProtocolMap` 追加 `forkRefreshMembershipInfo: () => void`。
- [x] 3.2 改 `src/fork/background/membership.ts`：① `adoptCredential` 拿到 tokens 后 `deriveMembershipInfo(tokens.tokens)` → `saveMembershipInfo`（清态代次校验，与 key 写同守卫）；② `clearMembership` 加 `await clearMembershipInfo()`（**防登出幽灵态**）；③ `setupMembership` 注册 `forkRefreshMembershipInfo` handler：读会话凭据 → `fetchTokens` → 派生 → `saveMembershipInfo`（无会话则跳过）。
- [x] 3.3 `pnpm run type-check` 0（留意 message.ts 若有 .d.mts sidecar 需同步——本文件通常无）。

## 4. 多语言路径泛化（website-locale）· TDD

- [x] 4.1 改 `src/fork/membership/__tests__/website-locale.test.ts`（RED）：`websiteLocalePath(uiLanguage, path)`——`zh-CN`+`/orders`→`/zh-hans/orders`、`en`+`/orders`→`/orders`、`zh-TW/ja/ko/es/ru/tr` 各前缀、`vi`→`/orders`（回退）、`websiteLocalePath(l,"/login")` 对各 locale 等于旧 `websiteLoginPath(l)`。
- [x] 4.2 跑红。
- [x] 4.3 `src/fork/membership/website-locale.ts`：`websiteLoginPath` 泛化为 `websiteLocalePath(uiLanguage, path)`（删薄包装）；同步改 `atoms.ts` 的 `useOpenForkLogin`（→ `websiteLocalePath(locale,"/login")`）。
- [x] 4.4 跑测试绿；`type-check` 0。

## 5. 订单跳转 helper

- [x] 5.1 `src/fork/membership/atoms.ts` 紧邻 `useOpenForkLogin` 加 `useOpenForkOrders()`：`resolveUiLocale` → `browser.tabs.create({ url: env.WXT_WEBSITE_URL + websiteLocalePath(locale, "/orders") })`。
- [x] 5.2 `type-check` 0。

## 6. 账户面板：会员信息展示 + 订单项 + 挂载刷新 + i18n（两壳）

- [x] 6.1 i18n：核对 i18n facade（`src/utils/i18n` + `resources.ts`）是否支持 fork 顶层段；9 个 `src/locales/*.yml` 加会员 + 订单文案（`forkMembership.tierFree`「免费」/`tierPro`「PRO」/`expiry`「到期」/`remainingTokens`「剩余 **AMOUNT** token」/`myOrder`「我的订单」，译文对齐官网 `account` 段）。facade 不支持 fork 段则退 `account.fork*`。**不塞上游 `account:` 块**。
- [x] 6.2 改 `src/fork/ui/popup/account-menu.tsx`：读 `membershipInfoAtom` —— 手机号旁「免费/PRO」徽章；`tier==="pro"` 多一行「到期 {expiryDate} · 剩余 {formatCredits(remainQuota)} token」；free 只徽章。挂载 `useEffect(() => { void sendForkMessage("forkRefreshMembershipInfo") }, [])`。separator 后、登出前插「我的订单」`DropdownMenuItem`（`useOpenForkOrders`）。
- [x] 6.3 改 `src/fork/ui/options/account-menu-sidebar.tsx`：同 6.2（会员信息展示 + 订单项 + 挂载刷新；侧边栏壳 JSX 独立改）。
- [x] 6.4 `pnpm run type-check` 0。

## 7. 验证（四关 + 实机）

- [x] 7.1 全量单测：临时移开本地 `.env` → `SKIP_FREE_API=true pnpm run test` → 恢复 `.env`（0 失败）。
- [x] 7.2 `pnpm run type-check`（0 报错）。
- [x] 7.3 `FORK_DIFF_BASE=HEAD node scripts/check-fork-boundary.mjs`（仅本次改动，无越界、零 allowlist 新增）。
- [x] 7.4 `node scripts/check-fork-brand.mjs`（新增文案无品牌漂移）。
- [x] 7.5 实机（fork 改动，涉 background 需完整重启 dev）：会员登录后 popup 与侧边栏账户面板显示「免费/PRO」徽章；PRO 显到期 + 剩余用量；popup 打开触发用量刷新（消耗后重开数值更新）；点「我的订单」按 UI 语言跳官网订单页；登出后面板无 PRO/用量残留；登录/登出行为不变。
