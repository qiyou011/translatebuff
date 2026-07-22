## Context

`fork-membership-login` 已落地 cookie 驱动的登录接管：官网登录后在自己域种 first-party cookie `Login-Credential`（其值即 `login_credential`，后端以显式 `Login-Credential` 请求头认证），扩展后台 `browser.cookies.onChanged` 监听该 cookie 变化 → `adoptCredential(cookie.value)` 建立会话（取用户信息 → 写会话 → 取 sk_key/base_url → 注入 → 拉模型），含 `clearGeneration` 防登出竞态。

**缺口**：接管**纯被动**——只响应 cookie 的**变化事件**。用户装插件前已在官网登录（cookie 早已存在、之后不变）或 service worker 冷启动时 cookie 已在，`onChanged` 不触发，`ensureMembershipKey` 又在无会话时直接 return、不读 cookie。全仓无 `browser.cookies.get`，无任何主动读「已存在 cookie」的路径。

## Goals / Non-Goals

**Goals:**

- 官网已登录时，插件冷启动即主动探测已存在的凭据 cookie 并接管，实现「装了/打开就同步」。
- popup / 选项页挂载时确定性触发一次同步，闭合 SW 空闲与瞬时接管失败留下的补偿窗口。
- 消除主动探测与被动监听并发重复接管的冗余。

**Non-Goals:**

- 不改被动 watcher 的判定逻辑（`decideCookieAction`）与 `adoptCredential` 的下游链路。
- 不加 manifest 权限（`cookies` + `*://*/*` 已够）、不改上游文件、不增 allowlist。
- 不做周期性 `alarms` 轮询探测（冷启 + 挂载已覆盖，避免过度设计）。
- 不处理 prod「cookie 为 apex host-only」情形（属既有 `forkLogout` 同一假设，另行确认）。

## 文件结构（改动落点，全 `src/fork/**`）

| 文件                                               | 职责                                                 | 新增/改 |
| -------------------------------------------------- | ---------------------------------------------------- | ------- |
| `src/fork/background/membership.ts`                | 主动探测函数 + 接管在途去重 + `setupMembership` 接线 | 改      |
| `src/fork/message.ts`                              | fork 专属消息 `forkSyncMembership`                   | 改      |
| `src/fork/membership/atoms.ts`                     | UI 挂载时发送同步消息                                | 改      |
| `src/fork/background/__tests__/membership.test.ts` | 探测/去重/接线单测                                   | 改      |

## Decisions

### D1 主动探测函数 `syncMembershipFromWebsite`

新增于 `membership.ts`；无会话才探测接管（有会话短路，不重复接管；key 空补偿仍由既有 `ensureMembershipKey` 承担，二者正交）。

```ts
// 冷启动/挂载主动同步：读官网域已存在的 Login-Credential cookie，无会话且 cookie 在 → 复用 adoptCredential 接管。
export async function syncMembershipFromWebsite(): Promise<void> {
  if (await loadForkSession()) return // 已有会话，不重复接管
  if (!browser.cookies?.get) return // 能力探测（部分环境无 cookies.get）
  let cookie
  try {
    cookie = await browser.cookies.get({
      url: `${env.WXT_WEBSITE_URL}/`,
      name: CREDENTIAL_COOKIE_NAME,
    })
  } catch {
    return // 读 cookie 异常 → 优雅降级
  }
  if (cookie?.value) await adoptCredential(cookie.value)
}
```

`CREDENTIAL_COOKIE_NAME` 从 `cookie-decision.ts` 导入（单一来源）；`env`、`browser`、`loadForkSession`、`adoptCredential` 均为本文件已有依赖。

### D2 cookie 读取 url 对齐 `forkLogout`

读取用 `${env.WXT_WEBSITE_URL}/`，与 `forkLogout` 的 `cookies.remove` 完全对称（同一登录域的 set/get/remove 一致）。不遍历 `WXT_OFFICIAL_SITE_ORIGINS`——那是 watcher 的防御性宽匹配；用户实际登录发生在 `WXT_WEBSITE_URL`，cookie 必在此可见。

### D3 UI 挂载确定性同步：新增 fork 消息 `forkSyncMembership`

`message.ts` 的 `ForkProtocolMap` 加 `forkSyncMembership: () => void`（fork 专属契约，非上游 `message.ts`，无红线）。`membership.ts` 的 `setupMembership` 接 `onForkMessage("forkSyncMembership", () => void syncMembershipFromWebsite())`。`atoms.ts` 的 `useForkSession` 挂载时发一次 `sendForkMessage("forkSyncMembership")`——发消息**确定性唤醒 SW**（读 storage 不唤醒 SW，无会话分支现有代码不发任何消息）。有会话时后台 `syncMembershipFromWebsite` 首步即短路。

### D4 接管在途去重下沉到 `adoptCredential`

`membership.ts` 加模块级 `const adoptInFlight = new Set<string>()`；`adoptCredential` 首行按凭据判重、`try/finally` 释放：

```ts
export async function adoptCredential(loginCredential: string): Promise<void> {
  if (adoptInFlight.has(loginCredential)) return
  adoptInFlight.add(loginCredential)
  try {
    /* 既有编排原样 */
  } finally {
    adoptInFlight.delete(loginCredential)
  }
}
```

一处守护覆盖 watcher + probe + 消息全部调用方；同凭据并发只跑一遍，异凭据互不阻塞。既有测试均顺序 await，不受影响。

### D5 冷启接线

`setupMembership` 在 `registerCookieWatcher()` 后加 `void syncMembershipFromWebsite()`（先注册监听再补读，避免读与事件间漏窗）。SW 每次冷启（含 onInstalled、浏览器启动、消息唤醒）都会跑，无需另挂 `onStartup/onInstalled`。

## Risks / Trade-offs

- **双 adopt 竞态**：`syncMembershipFromWebsite` 的 `loadForkSession()` 与 `adoptCredential` 间有 await 让出点，watcher 可能在其间完成接管 → 由 D4 的凭据级去重兜底（幂等收敛，最多一次冗余判重后短路）。
- **prod domain 分歧**：探测用 `WXT_WEBSITE_URL`（prod=www）、watcher 用 `WXT_OFFICIAL_SITE_ORIGINS`（prod 含 apex+www）。若 cookie 为 apex host-only 则探测可能漏读——但 `forkLogout` 已依赖同一「cookie 在 `WXT_WEBSITE_URL` 可读」前提，风险与既有一致，留后端确认。
- **挂载每次发消息**：每次 popup/选项页打开唤醒一次 SW，有会话即短路，成本可忽略；换来确定性自愈。
