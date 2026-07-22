## Why

用户在官网已登录（会话凭据 cookie 已存在）后安装或打开插件，插件仍显示「登录」、需要再走一遍「popup 点登录 → 跳官网 → 重新登录」。根因：现有登录接管是**纯被动**——后台只监听官网凭据 cookie（`Login-Credential`）的**变化事件**（`browser.cookies.onChanged`）。装插件前 cookie 早已存在、之后不再变化时事件不触发；service worker 冷启动也从不主动读已存在的 cookie。于是出现「官网已登录、插件未同步」的割裂，违背「装了/打开就能用」的预期。

## What Changes

- 后台新增**主动探测**：service worker 冷启动时主动读一次官网域已存在的 `Login-Credential` cookie，有值即复用既有接管流程建立会话——补上被动监听读不到「已存在 cookie」的唯一缺口。
- **UI 挂载确定性同步**：popup / 选项页挂载时经 fork 专属消息唤醒后台跑一次探测，闭合「SW 空闲 + 无会话 + cookie 在」及「瞬时接管失败留下有 cookie 无会话」的补偿窗口。
- **接管去重**：为凭据接管加按凭据的在途去重，避免主动探测与被动监听并发重复接管（幂等但冗余的开户轮询网络 + 并发配置读改写）。

## Capabilities

### New Capabilities

- `fork-membership-autosync`: 冷启动与 UI 挂载时主动探测官网已存在会话并接管，补齐被动 cookie 监听的缺口，实现「官网已登录 → 插件自动同步账号」。复用 `fork-membership-login` 的接管 / 清态 / 密钥注入 / 模型同步全链路，不改其行为。

### Modified Capabilities

- （无。本变更不改 `fork-membership-login` 的 spec 级行为，仅新增一条主动探测入口复用其既有流程。）

## Impact

- 代码（全落 `src/fork/**`，无上游 / manifest / allowlist 改动，无红线）：
  - `src/fork/background/membership.ts` —— 新增主动探测函数 + 接管在途去重 + `setupMembership` 接线
  - `src/fork/message.ts` —— 新增 fork 专属消息（挂载触发同步）
  - `src/fork/membership/atoms.ts` —— UI 挂载时发送同步消息
- 权限：无新增（`cookies` + `host_permissions: *://*/*` 已足够，与既有 watcher / `forkLogout` 同源）。
- 已知假设：探测读 cookie 的 url 与 `forkLogout` 删 cookie 一致取 `WXT_WEBSITE_URL`（用户实际登录域）；prod 若官网把 cookie 设为 apex host-only，则探测与 `forkLogout` 需一并调整——属既有假设，本次不扩面。
- 测试参考：`src/fork/background/__tests__/membership.test.ts` —— 冷启探测（cookie 有/无 × 会话 有/无）、`cookies.get` 异常降级、并发接管去重、`setupMembership` 接线四维度。
