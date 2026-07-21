## ADDED Requirements

### Requirement: 冷启动主动探测已存在会话

`[API层]` service worker 冷启动时，后台 MUST 主动读一次官网域已存在的凭据 cookie（`Login-Credential`）；仅在本地无有效会话（forkSession 不存在）且 cookie 有值时，MUST 复用既有凭据接管流程建立会话。这补齐被动 `cookies.onChanged` 监听读不到「已存在 cookie」的缺口——绝不改动被动监听判定与接管下游链路。

#### Scenario: 装插件前已登录官网，冷启即接管

- **GIVEN** 官网域已存在有效 `Login-Credential` cookie，且本地无 forkSession
- **WHEN** service worker 冷启动执行 `setupMembership`（含安装、浏览器启动、消息唤醒）
- **THEN** 后台 MUST 以 `browser.cookies.get({ url: WXT_WEBSITE_URL + "/", name: "Login-Credential" })` 读取该 cookie
- **AND** 读到非空 value 时 MUST 调用既有 `adoptCredential(value)` 走「取用户信息 → 写会话 → 取 sk_key/base_url → 注入 → 拉模型」全链路
- **AND** 接线 MUST 在 `registerCookieWatcher()` 之后执行（先注册监听再补读，避免读与事件间漏窗）

#### Scenario: 已有会话则短路，不重复接管

- **GIVEN** 本地已存在有效 forkSession
- **WHEN** 主动探测执行
- **THEN** 探测 MUST 在读取 cookie 前即短路返回，MUST NOT 再次接管或发起任何平台接口请求（key 空的补偿仍由既有挂载补偿 `ensureMembershipKey` 承担，与本探测正交）

#### Scenario: 无 cookie 或读取异常降级不阻断

- **WHEN** 官网域无 `Login-Credential` cookie，或 `browser.cookies.get` 不可用 / 抛错
- **THEN** 探测 MUST 优雅返回（能力探测 `browser.cookies?.get` + `try/catch`），MUST NOT 抛错阻断后台其余接线，MUST NOT 建立会话

### Requirement: UI 挂载确定性触发同步

`[UI层][API层]` popup / 选项页挂载时 MUST 经 fork 专属消息确定性唤醒后台跑一次主动探测，闭合「service worker 空闲 + 无会话 + cookie 已在」以及瞬时接管失败留下的「有 cookie 无会话」补偿窗口。该消息 MUST 属 fork 独立协议，绝不进上游 `message.ts`。

#### Scenario: 挂载发送同步消息

- **GIVEN** popup 或选项页账户菜单挂载
- **WHEN** `useForkSession` 挂载副作用执行
- **THEN** 前端 MUST 发送 fork 消息 `forkSyncMembership`（发消息以确定性唤醒 service worker——读 storage 不唤醒 SW）
- **AND** 后台 MUST 以 `onForkMessage("forkSyncMembership", …)` 接线并跑主动探测；有会话时后台 MUST 短路，不产生冗余请求

### Requirement: 凭据接管在途去重

`[API层]` 凭据接管 MUST 按凭据做在途去重，使主动探测、被动监听、挂载消息等多路径对**同一凭据**的并发接管只实际执行一次，避免冗余的开户轮询网络与并发配置读改写。去重 MUST 覆盖全部接管调用方（守护下沉到 `adoptCredential`，而非仅守探测侧）。

#### Scenario: 同凭据并发只接管一次

- **GIVEN** 主动探测与被动监听可能对同一 `Login-Credential` 值近乎同时触发接管
- **WHEN** 同一凭据的 `adoptCredential` 在前一次尚未完成时再次被调用
- **THEN** 后续调用 MUST 立即短路返回（模块级在途标记按凭据判重），仅首次实际发起 login_status / tokens 请求
- **AND** 接管完成后 MUST 释放该凭据的在途标记（`try/finally`），使后续续期/重登可再次接管；不同凭据 MUST NOT 互相阻塞

### Requirement: 软 fork 边界合规

`[约束]` 本变更所有新增 / 修改 MUST 落在 `src/fork/**` 内，无 allowlist 增长、无越界改上游文件、无 manifest 权限新增。

#### Scenario: 边界与权限校验通过

- **WHEN** 运行 fork 边界校验
- **THEN** MUST NOT 出现 `src/fork/**` 之外的改动，MUST NOT 新增 `scripts/fork-allowlist.json` 条目
- **AND** MUST NOT 改动上游 `src/utils/message.ts`、config zod schema、`providers.ts` / `models.ts` / migration
- **AND** MUST 复用既有 `cookies` + `host_permissions: *://*/*` 权限，MUST NOT 新增 manifest 权限
