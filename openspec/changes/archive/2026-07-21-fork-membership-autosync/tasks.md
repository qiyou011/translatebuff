## 1. 凭据接管在途去重（D4，先做——后续探测依赖它防双 adopt）

- [x] 1.1 [RED] 在 `membership.test.ts` 加用例：同一凭据并发两次 `adoptCredential` 只发起一遍 login_status 请求（`expect(fetchMock login_status calls).toBe(1)`）；跑测试确认失败
- [x] 1.2 [GREEN] `membership.ts` 加模块级 `const adoptInFlight = new Set<string>()`；`adoptCredential` 首行 `if (adoptInFlight.has(cred)) return`、`adoptInFlight.add(cred)`，既有编排包进 `try`，`finally { adoptInFlight.delete(cred) }`
- [x] 1.3 跑该用例 + 既有 `adoptCredential` 全部用例确认通过（顺序 await 用例不受去重影响）

## 2. 主动探测函数 syncMembershipFromWebsite（D1/D2）

- [x] 2.1 [RED] 加用例：无会话 + mock `cookies.get` 返回官网 `Login-Credential` → 调 `syncMembershipFromWebsite` → 断言 forkSession 写入（手机号）+ key 注入 + 读取 url=`${WXT_WEBSITE_URL}/`；跑测试确认失败（函数未实现）
- [x] 2.2 [RED] 补边界用例三条：① 已有会话 → 短路、`cookies.get`/`fetchMock` 未被调用；② 无 cookie → 不接管、无请求；③ `cookies.get` 抛错（`mockRejectedValue`）→ 优雅返回、无会话
- [x] 2.3 [GREEN] 实现 `syncMembershipFromWebsite`（无会话短路 → 能力探测 `browser.cookies?.get` → `cookies.get({url: WXT_WEBSITE_URL+"/", name: CREDENTIAL_COOKIE_NAME})` try/catch → 有 value 调 `adoptCredential`）；从 `cookie-decision` 导入 `CREDENTIAL_COOKIE_NAME`；测试 `afterEach` 补 `vi.restoreAllMocks()` 防 spy 泄漏
- [x] 2.4 跑 2.1–2.2 全部用例确认通过

## 3. 冷启接线（D5）

- [x] 3.1 [RED] 加用例：mock `cookies.get` 返回 cookie + mock `cookies.onChanged.addListener` + `routeOk` → 调 `setupMembership()` → `vi.waitFor` → 断言 forkSession 已接管；跑测试确认失败
- [x] 3.2 [GREEN] `setupMembership` 在 `registerCookieWatcher()` 之后加 `void syncMembershipFromWebsite()`
- [x] 3.3 跑用例确认通过

## 4. UI 挂载确定性同步（D3）

- [x] 4.1 [GREEN] `src/fork/message.ts` 的 `ForkProtocolMap` 加 `forkSyncMembership: () => void`（带注释：挂载触发主动探测）
- [x] 4.2 [GREEN] `membership.ts` 的 `setupMembership` 加 `onForkMessage("forkSyncMembership", () => void syncMembershipFromWebsite())`
- [x] 4.3 后台 handler 是一行委托、与既有 `forkEnsureMembershipKey` 同型（既有 handler 亦不单测消息往返）；其目标 `syncMembershipFromWebsite` 已被 2.x 充分覆盖，故不另写脆弱的消息传输用例，由 `setupMembership` 不抛错（3.1 已证接线）+ 函数用例共同保障
- [x] 4.4 [GREEN] `atoms.ts` 的 `useForkSession` 挂载副作用（`[setSession]` effect）内 `void sendForkMessage("forkSyncMembership")`（注释：挂载即请后台补读官网 cookie，有会话则后台短路）

## 5. 验证四关 + 实机

- [x] 5.1 单测：本变更新增 15/15 绿（`membership.test.ts`）；全量套件仅 2 处失败（`config.test.ts`/`context-menu.test.ts`），经 baseline（stash 掉本次改动）复现，证实为**既有 flaky**（隔离跑均通过）、非本次回归
- [x] 5.2 `pnpm run type-check` exit 0（修 cookies.get 重载致 void 的类型问题：改调用式 + `.catch(()=>null)`）
- [x] 5.3 fork 边界：本次改动全在 `src/fork/**` + `openspec/**`，无越界、无 allowlist 增长
- [x] 5.4 `node scripts/check-fork-brand.mjs` 通过
- [x] 5.5 实机（用户端确认后指示归档）：官网先登录 → 装/开插件 → popup 无需点登录即显示已登录（脱敏号 + 积分/到期）；官网登出 → 插件随之清态
