## Context

**账户面板 fork 壳**（两份、JSX 不共享、逻辑基座共享）：popup `ForkAccountMenu`（`src/fork/ui/popup/account-menu.tsx`）、侧边栏 `UserAccountMenuSidebar`（`src/fork/ui/options/account-menu-sidebar.tsx`）。base-ui `DropdownMenu`，登录态二级菜单**目前仅手机号 + 登出**。

**会员态接线现状**（`src/fork/`）：

- `membership/api.ts` `fetchTokens(cred)` 打 `/api/claw_bff/v1/tokens`，只取 `tokens[0].sk_key` + `base_url` 返回 `{ skKey, baseUrl } | null`（skKey 空→null 供 `fetchTokensWithRetry` 轮询）——**tokens 数组的会员字段全丢**。
- `background/membership.ts`：`adoptCredential`（:74，登录编排：fetchLoginStatus→saveForkSession→fetchTokensWithRetry→写 key）、`clearMembership`（:49，clearGeneration++ + clearForkSession + 清 key）、`setupMembership`（:179，注册 fork 消息 handler）。`ensureMembershipKey`（:129，挂载补偿也拿 tokens）。
- `message.ts`：fork 独立 `ForkProtocolMap`（forkPing/EnsureMembershipKey/SyncMembership/ClearMembership）。
- `membership/atoms.ts`：`forkSessionAtom`（storage.watch 范式）、`useOpenForkLogin`（:83-89）。

**官网权威派生逻辑**（复刻源 `translatebuff-web/src/utils/credits.ts`）：会员信息全从 tokens 数组**主档**（priority 最高）派生——`deriveTier`（主档 `token_name==='subscription'` 且 `expired_time`(-1 或 >now) 未过期 → pro）、到期取主档 `final_expire_at` 日期部分、用量取主档 `remain_quota`/`total_quota`。**用后端 tier 字段官网不采信**，用户已确认复刻前端推断。

**跳转官网**：`useOpenForkLogin` 用 `browser.tabs.create({ url: env.WXT_WEBSITE_URL + websiteLoginPath(locale) })`，**不用 `getWebsiteUrl`**（localhost hash 路由坑）。`website-locale.ts` 有 `UI_LOCALE_TO_WEBSITE_LOCALE` 映射（`zh-CN→zh-hans`、`en→""`、vi 回退）。

**i18n**：账户菜单走上游 facade（`account.login/logout`）。9 个 `src/locales/*.yml` 已在 allowlist（会员替换预留）。官网 `/orders` + 多语言路由已确认。

## Goals / Non-Goals

**Goals:**

- 账户面板简洁展示会员类型（免费/PRO 徽章）+ PRO 的到期与剩余用量；用量 popup 打开时实时刷新。
- 追加「我的订单」入口，按 UI 语言跳官网订单页。
- 会员判定复刻官网 deriveTier（主档推断）。全 C 类，零 allowlist。

**Non-Goals:**

- 不做头像图片/首字母（沿用 `IconUserCircle` 占位，仅加徽章）；不照抄官网大号百分比+进度条+升级引导。
- 不用后端 tier 字段；不改上游引擎/config schema/上游 message.ts。
- 不做轮询/定时刷新（仅 popup 打开触发一次）。
- 不改仓库 About（需求③，权限外）。

## Decisions

### D1 · 会员派生纯函数 `membership/tier.ts`（复刻官网）

新增 C 类纯函数：`deriveMembershipInfo(tokens): MembershipInfo`，内含 `pickPrimaryToken`（priority 最高、缺失取靠前）+ `deriveTier` + 到期切分 + 用量提取，**逐字复刻官网 `credits.ts`**。**头注释标同源指针**（「改官网 credits.ts 须同步本文件」）+ **就近黄金用例测试**（搬官网 `credits.test.ts` 边界：`-1` 永不过期、priority 缺失、已过期订阅判 free、空/非数组）。跨仓契约常量注释标注（`SUBSCRIPTION_TOKEN_NAME='subscription'`、`expired_time=-1`）。

### D2 · `fetchTokens` 加性扩展带原始 tokens

`TokensResult` **追加** `tokens: RawToken[]`（原始数组），保持 `skKey`/`baseUrl`/null 语义不变（三处消费 + 轮询不受影响）。供 `deriveMembershipInfo` 按 priority 选主档。null（开户未完成、无 token）时会员信息落 free 默认。

### D3 · 会员信息独立 `forkMembershipInfo`（storage key + atom，不进 ForkSession）

新增 `membership/membership-info.ts`：`MembershipInfo` 类型 + 独立 storage key 读写（`saveMembershipInfo`/`loadMembershipInfo`/`clearMembershipInfo`）+ `membershipInfoAtom`（复刻 `forkSessionAtom` 的 storage.watch 范式）。**不塞 ForkSession**——用量是动态值，钉进登录快照会陈旧；独立键还免掉 session schema 扩展/迁移（采纳架构审查 A）。

### D4 · popup 打开触发一次刷新（`fork/message.ts` +1 消息）

`ForkProtocolMap` 加 `forkRefreshMembershipInfo: () => void`。账户面板挂载时 `sendForkMessage("forkRefreshMembershipInfo")` → background handler 用会话凭据 `fetchTokens` → `deriveMembershipInfo` → `saveMembershipInfo`。**不轮询/不定时**（采纳审查 B）。登录时 `adoptCredential`（拿到 tokens 处）也一并派生写入，保证首屏有值。

### D5 · `clearMembership` 显式清 `forkMembershipInfo`（防幽灵态）

`clearMembership`（:49）加 `await clearMembershipInfo()`。否则登出后残留上一用户 PRO 徽章/用量（独立键不被 `clearForkSession` 整键删带走）。

### D6 · 简洁展示（不照抄官网）

两壳读 `membershipInfoAtom`：手机号旁「免费/PRO」pill 徽章（配色可借官网 `bg-foreground text-background` / `bg-muted text-foreground`，尺寸自定）；**PRO 才**多一行「到期 {date} · 剩余 {formatCredits(remainQuota)} token」；free 只徽章。未登录不渲染。

### D7 · 订单入口 helper `useOpenForkOrders`（`membership/atoms.ts`）

仿 `useOpenForkLogin`：`browser.tabs.create({ url: env.WXT_WEBSITE_URL + websiteLocalePath(locale, "/orders") })`。两壳 separator 后、登出前各插「我的订单」`DropdownMenuItem`。

### D8 · `websiteLoginPath` 泛化 `websiteLocalePath(uiLanguage, path)`

登录与订单共用；`websiteLoginPath` 仅 2 处消费（atoms:87 + test），直接替换薄包装。`websiteLocalePath(l, "/login") ≡ 旧 websiteLoginPath(l)` 由测试锁死。

### D9 · i18n 用 fork 命名段

会员 + 订单文案走独立顶层段（如 `forkMembership.*`：tierFree/tierPro/expiry/remainingTokens/myOrder），不并进上游 `account:`（降 merge 冲突）。9 语译文对齐官网 `account` 段。apply 时核对 facade 是否支持 fork 顶层段，否则退 `account.fork*`。

## 文件结构

| 操作 | 文件                                                   | 职责                                                                             |
| ---- | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| A    | `src/fork/membership/tier.ts`                          | 复刻官网会员派生纯函数 `deriveMembershipInfo`                                    |
| A    | `src/fork/membership/__tests__/tier.test.ts`           | 黄金用例（官网 credits.test.ts 边界）                                            |
| A    | `src/fork/membership/membership-info.ts`               | `MembershipInfo` 类型 + storage 读写 + `membershipInfoAtom`                      |
| M    | `src/fork/membership/api.ts`                           | `fetchTokens` 加 `tokens` 字段（加性）                                           |
| M    | `src/fork/membership/__tests__/api.test.ts`            | 断言 fetchTokens 携带 tokens、skKey/null 不变                                    |
| M    | `src/fork/message.ts`                                  | `ForkProtocolMap` + `forkRefreshMembershipInfo`                                  |
| M    | `src/fork/background/membership.ts`                    | adopt 派生写 info · clearMembership 清 info · setupMembership 加 refresh handler |
| M    | `src/fork/membership/atoms.ts`                         | `useOpenForkOrders`；`useOpenForkLogin` 改用 `websiteLocalePath`                 |
| M    | `src/fork/membership/website-locale.ts`                | `websiteLoginPath` → `websiteLocalePath(uiLanguage, path)`                       |
| M    | `src/fork/membership/__tests__/website-locale.test.ts` | 泛化 + `/orders` 各 locale + 回退用例                                            |
| M    | `src/fork/ui/popup/account-menu.tsx`                   | 会员信息展示 + 订单项 + 挂载触发刷新                                             |
| M    | `src/fork/ui/options/account-menu-sidebar.tsx`         | 会员信息展示 + 订单项                                                            |
| M    | `src/locales/*.yml`（9，allowlist 内）                 | fork 命名段会员 + 订单文案                                                       |

## 接口契约

```ts
// membership/tier.ts
export interface RawToken {
  token_name?: string
  expired_time?: number
  final_expire_at?: string
  remain_quota?: number
  total_quota?: number
  priority?: number
}
export interface MembershipInfo {
  tier: "free" | "pro"
  expiryDate: string | null // "2027-07-24" | null
  remainQuota: number
  totalQuota: number
}
export function deriveMembershipInfo(tokens: RawToken[]): MembershipInfo
//   主档=priority 最高；tier=主档 subscription+未过期?pro:free；
//   expiryDate=主档 final_expire_at.split(" ")[0] ?? null；remain/total=主档额度 ?? 0

// membership/membership-info.ts
export const membershipInfoAtom // atom<MembershipInfo | null>（storage.watch）
export function saveMembershipInfo(info: MembershipInfo): Promise<void>
export function loadMembershipInfo(): Promise<MembershipInfo | null>
export function clearMembershipInfo(): Promise<void>

// api.ts —— 加性
export interface TokensResult {
  skKey: string
  baseUrl: string
  tokens: RawToken[]
} // +tokens

// message.ts —— ForkProtocolMap 追加
// forkRefreshMembershipInfo: () => void

// atoms.ts
export function useOpenForkOrders(): () => void

// website-locale.ts —— 替换 websiteLoginPath
export function websiteLocalePath(uiLanguage: string, path: string): string
//   const locale = uiLanguageToWebsiteLocale(uiLanguage); return locale ? `/${locale}${path}` : path
```

两壳会员信息 + 订单项（separator 后 / 登出前）：

```tsx
const info = useAtomValue(membershipInfoAtom)
const openOrders = useOpenForkOrders()
useEffect(() => {
  void sendForkMessage("forkRefreshMembershipInfo")
}, []) // 挂载刷新
// 手机号行旁： {info && <TierBadge tier={info.tier} />}
// info?.tier==="pro" && <div>到期 {info.expiryDate} · 剩余 {formatCredits(info.remainQuota)} token</div>
// <DropdownMenuItem onClick={openOrders}>我的订单</DropdownMenuItem>
```

## Risks / Trade-offs

- **fetchTokens null 与会员信息**：skKey 空（开户未完成）→ fetchTokens null → 会员信息落 free 默认。free 用户开户完成有非订阅 token 时 fetchTokens 非 null、`deriveMembershipInfo` 正确判 free。语义自洽。
- **登出清态（硬约束）**：`clearMembership` 必须清 `forkMembershipInfo`（D5），由「登出后面板无 PRO 残留」用例守。
- **跨仓复刻漂移**：tier.ts 与官网 credits.ts 无 merge 关系，靠头注释同源 + 黄金测试控（D1）。
- **fetchTokens 加性**：只追加 `tokens`，不动 skKey/baseUrl/null（三处消费 + retry 不回归），由 api 测试守。
- **泛化不回归登录**：`websiteLocalePath(l,"/login") ≡ 旧 websiteLoginPath(l)` 测试锁死。
- **i18n facade 段支持性**：fork 顶层段依赖 facade 允许——apply 时核对，不支持退 `account.fork*`。
- **回滚**：纯 fork 增量，撤新文件 + 消息 + 两壳改动 + 泛化还原，无数据迁移。

## Open Questions

无。技术方案两轮设计 + 架构审查通过（数据流 A 独立 atom、B popup 刷新已采纳）。菜单项图标、徽章具体尺寸、i18n 段支持性属实现细节，apply 时定。
