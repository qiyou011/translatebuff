## Context

translatebuff-app 是 read-frog 的软 fork（WXT + MV3 + React）。任译喵是**独立会员体系**（平台 common_bll/claw_bff 后端 + one-api 网关），与上游 better-auth 无关。翻译能力靠登录后平台下发的 one-api `sk_key`。

参考实现为生产已跑的 724aimanager（app=Tauri 桌面端、web=Next.js 官网）；平台文档明确「任译喵完全参考 aimanager、接口零改动」。经探索核实：

- 参考实现**没有「官网→客户端推送登录态」**通道；桌面端自登录，`temp_token` 是**反向** SSO（客户端→官网免登）；凭据 `Login-Credential` 是**非 HttpOnly 可读 cookie**（30 天）；`sk_key` 由客户端自调 `/v1/tokens` 取（薄凭据两段式）。
- 任译喵官网 `translatebuff-web` **当前是纯视觉占位登录**（不调后端、不写 cookie、无 API 域配置）；后端测试域「待运维给」。
- fork 已有 `src/fork/providers/renyimiao.ts`：`setRenyimiaoApiKey` 广播写实例 apiKey、`renyimiaoApiKey` 供设置页读、`ensureRenyimiaoSeeded` 幂等 seed；`RENYIMIAO_GATEWAY_BASE_URL` 是硬编码的 one-api 翻译网关（**与登录后端 common_bll/claw_bff 是不同域、不同性质**）。
- 上游 `proxy-fetch.ts` 已用 `browser.cookies.onChanged` 监听 better-auth cookie，可作 fork 监听范式参考。

本设计经三轮 architect-review 收口（详见 Risks）。

## Goals / Non-Goals

**Goals:**

- 打通「popup 点登录 → 跳官网登录 → 插件接管凭据 → 取用户信息与 sk_key → 注入设置页 provider」。
- 登录得到的 sk_key 自动填入设置页「任译喵 API Key」（只读），登出/失效清空。
- 因官网真登录与后端测试域未就绪，先以本地 mock 替身跑通插件侧；真态仅切 env。
- 全部落 `src/fork` / `scripts` / `.env`，零 allowlist 增长。

**Non-Goals（坚决不做，防蔓延）:**

- 付费/下单/扫码支付（跳官网完成）。
- 用 sk_key 调模型翻译（下一迭代）——故本迭代**不写 base_url**、不接翻译请求。
- `temp_token` 反向 SSO（跳官网付费保持登录）。
- 极验人机校验（留在官网侧，不进 popup）。
- 官网 `translatebuff-web` 的真登录实现（官网团队负责，本变更只定契约）。

## Decisions

**D1. 架构 C：跳官网登录 + 读可读 cookie + 插件自取（否决 postMessage 推送 / 插件内登录）。**

- 否决「官网 postMessage 推送（原初稿）」：参考实现无此通道，官网需新造、两侧无先例、强耦合官网团队。
- 否决「插件内嵌登录表单（照搬 aimanager-app）」：popup 塞极验 + 短信 UI 过重，且任译喵文档 §3.1 明确「跳官网登录」。
- 选 C：复用参考实现真正依赖的「可读 Login-Credential cookie + 共享后端」，官网零改动（只需其正常登录写 cookie），popup 轻。

**D2. cookie 监听用 background `browser.cookies.onChanged`（非 content script）。**
`browser.cookies` 在后台即可读官网域 cookie（比 content script `document.cookie` 更强），照抄 `proxy-fetch` 范式即可 → 无 content script、无新入口、零 allowlist。但监听判定必须收紧（见 Risks R4）。

**D3. 凭据永远显式塞 header（禁用 `credentials:include` 自动带 cookie）。**
真态官网域与 API 域不同，`credentials:include` 不会跨域自动带 cookie；且 mock 同域会自动带、掩盖 header 路径。故插件**永远读 cookie 值、显式注入 `Login-Credential` 头**（对齐参考 `request-client`），mock/真态同一代码路径。mock 后端**强制校验该 header**（不认自动 cookie）。

**D4. 薄凭据两段式：插件自调 `/v1/tokens` 取 sk_key（对齐参考）。**
登录只给凭据；用户信息调 `login_status`、密钥调 `/v1/tokens`。API 基址由 fork **直读 `import.meta.env.WXT_RENYIMIAO_API_URL`**（绕 t3-env、不改 `src/env/shared.ts` 以保边界），构建期断言其存在。**此登录后端域 ≠ `RENYIMIAO_GATEWAY_BASE_URL` 翻译网关常量**，二者勿混。

**D5. sk_key 后台单写 + 设置页只读（消除并发写覆盖）。**
任译喵 key 由登录单一下发，用户无从手打。故：① 后台作为唯一写者，一次读-改-写（写前复读最新配置、对全部实例写同一值）；② 设置页「任译喵 API Key」改只读掩码、**移除手填写者** `handleApiKeyChange`。本迭代**只写 sk_key、不写 base_url**（不发翻译请求、baseURL 未被消费；base_url 单一真源留到翻译迭代，避免为假想需求预留+静默不一致）。

**D6. 开户轮询：连续 await 有界重试 + 挂载补偿（应对 MV3 SW 回收）。**
`/v1/tokens` 首登可能空（异步开户），轮询 +3s 起、每 3s、最多 3 次。**不用 `chrome.alarms`**——实测其最小粒度 30s（`delayInMinutes` 最小 0.5），无法满足 3s 节奏。改为事件处理器内连续 await（≤~9s 使 SW 在轮询期保持存活，不留裸 setTimeout 空闲空档）；SW 仍被回收时由 popup/选项页挂载补偿性幂等重拉兜底（经 `forkEnsureMembershipKey` 消息）。（`alarms` 权限上游 manifest 已具备，本迭代不需为此新增。）

**D7. 双存储职责切分。**
`forkSession`（fork 独立 storage）= 身份（loginCredential/phone/user）；sk_key 的 SSOT = providersConfig（设置页/引擎真消费方）。挂载对账自愈错配。

## 模块划分与接口契约

全部 `src/fork/**`（+ `scripts/` mock + `.env`）：

- `src/fork/membership/session.ts` — 会话存储
  - Produces：`ForkSession = { loginCredential: string; phone: string; user: {...} }`；`loadForkSession() / saveForkSession(s) / clearForkSession()`；读取 atom `forkSessionAtom`。独立 storage key + schema 版本 + 迁移链（隶属 `src/fork/config` 体系）。
- `src/fork/membership/api.ts` — 平台 API 客户端
  - Consumes：`import.meta.env.WXT_RENYIMIAO_API_URL`、cookie 值。
  - Produces：`fetchLoginStatus(cred) → { phone, user }`；`fetchTokens(cred) → { skKey }`（含开户轮询）；内部 header 装配（`Login-Credential` + `Saas-Product-Line=AITRANS` + `Saas-App-Id=aitrans-pc` + 7 段 `Useragent` + `Client-Language`）。**不写 base_url。**
- `src/fork/background/`（`setupFork()` 内接线） — cookie watcher + 编排
  - `browser.cookies.onChanged` → 判定接管/清态 → 调 api.ts → `saveForkSession` + 单写 key（读一次 config、seed + 写 sk_key、写一次，经 `storageAdapter` 配 `configSchema`）。清态调 `clearForkSession` + `setRenyimiaoApiKey("")`。
- `src/fork/ui/popup/` — fork 账户菜单
  - Consumes：`forkSessionAtom`。未登录→登录入口（`getWebsiteUrl` + locale 映射）；已登录→手机号。替换上游 `UserAccountMenuPopup`。
- `src/fork/ui/options/providers-config.tsx` — 设置页（fork 换皮件）
  - 任译喵 API Key 字段改只读掩码，删 `handleApiKeyChange` 写入路径。
- `scripts/mock-renyimiao/`（dev-only） — 替身官网 + 后端
  - 登录页 set 可读 `Login-Credential` cookie；`login_status` / `/v1/tokens` 强校验 header，`/v1/tokens` 返固定 `sk_key`。

**复用（不重写）**：`setRenyimiaoApiKey` / `renyimiaoApiKey` / `ensureRenyimiaoSeeded`（`renyimiao.ts`）；`storageAdapter`；`getWebsiteUrl`。

## 数据模型 / 契约

- `ForkSession`（fork 独立 storage）：`{ loginCredential: string; phone: string; user: object }`。**不入上游 configSchema、不复用 better-auth.session_token。**
- providersConfig 注入：经既有 `setRenyimiaoApiKey(config.providersConfig, skKey)`（仅改数据、非改 schema）。
- 官网侧契约（translatebuff-web 需兑现，本变更不实现）：正常手机号登录成功后，在官网域写**非 HttpOnly** `Login-Credential` cookie（30 天）。
- env：`WXT_RENYIMIAO_API_URL`（登录后端域，dev=mock/prod=真后端）；官网域走 `WXT_WEBSITE_URL`（dev=mock/prod=translatebuff.com）。

## Risks / Trade-offs

- **R1 [承重·已收口] 并发写覆盖**：删设置页手填写者后，login 成 apiKey 值层唯一真源；残留仅「首 seed × 首 login」极窄数组级竞态（既有已记录风险），靠幂等重 seed 收敛，**非靠原子性**（chrome.storage 无 CAS）。落地必须真删 `handleApiKeyChange`、login 写前复读+对全部实例写同值。
- **R2 [承重·已收口] MV3 SW 回收致轮询中断**：`chrome.alarms` + 挂载补偿兜底。
- **R3 [承重·已收口] mock 假绿 / 真态凭证 401**：显式 header + mock 强校验同一代码路径消除。API base 直读 import.meta.env、构建期 fail-fast 防漏配。
- **R4 [中] cookie 事件误判**：登出判定 `cause !== "overwrite"`；name 精确等值（非上游 `includes`）；`expired`/漏发靠 R5 兜底。
- **R5 [中] 401 兜底本迭代不生效**：本迭代不发翻译请求，A（key 单写）闭合**不挂靠 401**；401 清态主要覆盖 login_status/tokens 调用。
- **R6 [中] 挂载对账局限**：现对账只补缺失实例、不向既有实例重广播 key——key 丢失场景需在实现时显式补齐（对账时校验并重写 key）。
- **回滚**：全 fork 净新增 + 少量 fork 内改（设置页只读），移除即回退；`.env` 变量与 alarms 权限可撤。

## Open Questions

- 后端测试域（common_bll/claw_bff）具体地址——待运维；本迭代 mock 顶替。
- 官网 `translatebuff-web` 真登录 + 写可读 cookie 的排期——待官网团队；本变更只定契约。
- 7 段 UA 的渠道号（第 4 段）与 sn（第 7 段）取值——参考站渠道号 8188/8189，任译喵待定；实现时确认。
- `base_url` 单一真源方案——留到「用 sk_key 调模型翻译」迭代与 baseURL 消费一并做。
- `login_status` 返回的 user 字段具体形状——以真接口/参考站类型为准，实现时对齐。
