## Why

任译喵是「登录薄壳 + 翻译客户端」——真正的翻译能力靠平台会员体系下发的 one-api 密钥（sk_key）。当前插件没有任何登录：用户装了插件也拿不到 key，任译喵翻译不可用；设置页的「任译喵 API Key」只能手填，而这把 key 是平台登录后才发的，用户既拿不到、也不该手打。

本次打通「插件 → 官网登录 → 回插件」的登录交接：用户在 popup 点登录、跳官网完成手机号登录后，插件自动拿到凭据、取回用户信息与 sk_key 并注入设置页，实现登录即开箱可用；登出或凭据失效即清空，避免残留失效密钥。

## What Changes

- 会员会话：新增 fork 独立会话存储（登录凭据 + 手机号 + 用户信息），与上游 better-auth 完全隔离，独立 storage key。
- 登录入口：popup 提供任译喵登录入口，跳官网登录页（按当前界面语言映射官网多语言路径）。
- 凭据接管：官网登录写出可读凭据 cookie 后，插件后台监听 cookie 变化、读取凭据值。
- 凭据自取：后台以显式请求头（凭据 + 平台标识头 + UA）调平台接口，取当前用户信息与 one-api sk_key，含首登开户轮询。
- key 自动注入：登录得到的 sk_key 由后台单一写入任译喵 provider 配置，设置页「任译喵 API Key」自动填充并改为只读展示（移除手填写入路径）。
- 登出清态：官网登出（凭据 cookie 移除）或任一平台接口返回未授权时，清空会话与 provider 中的 key。
- 账户呈现：popup 以 fork 自有账户菜单呈现登录态，替换上游 better-auth 账户菜单，不并列两套登录。
- 本地联调替身：新增 dev-only 本地 mock（替身官网 + 后端），因官网真登录与后端测试域均未就绪；插件走同一套代码路径，真态仅切换 env 即可对接真接口。

## Capabilities

### New Capabilities

- `fork-membership-login`: 任译喵会员登录交接能力——popup 触发登录、跳官网、后台监听凭据 cookie 接管、显式携头取用户信息与 sk_key（含开户轮询）、注入并单写 provider key、登出与失效清态、fork 账户菜单呈现、dev mock 替身与 env 切真。

### Modified Capabilities

<!-- 无 openspec/specs/ 已归档能力的需求变更。设置页任译喵 key 字段改只读属本能力内的登录驱动需求；renyimiao provider 的 key 注入复用其现有函数，非改其规格。 -->

## Impact

- 新增代码：`src/fork/membership/**`（会话 + 平台 API 客户端）、`src/fork/background/`（cookie watcher 接线）、`src/fork/ui/popup/`（fork 账户菜单）、`scripts/mock-renyimiao/`（dev-only 替身）。
- fork 内修改：`src/fork/ui/options/providers-config.tsx`（任译喵 key 字段改只读、移除手填写者）；`src/fork/message.ts` / `setupFork()`（如需 background↔UI 消息）。
- 配置：`.env` 新增 `WXT_RENYIMIAO_API_URL`（登录后端域，fork 直读 `import.meta.env`，不碰 `src/env/shared.ts`）；manifest 增 `"alarms"` 权限（`cookies` 与 `host_permissions` 已具备）。
- 复用上游/fork：`renyimiao.ts` 的 `setRenyimiaoApiKey` / `ensureRenyimiaoSeeded`；上游 `proxy-fetch` 的 `cookies.onChanged` 监听范式。绝不改 better-auth / `message.ts` / config zod schema。
- 外部依赖（阻塞真态、本迭代由 mock 顶替）：① 任译喵后端测试域（common_bll / claw_bff，待运维给）；② 官网 `translatebuff-web` 真登录并写可读 `Login-Credential` cookie（待官网团队）。
- 软 fork 边界：全部落 `src/fork/**` + `scripts/**` + `.env`，零 allowlist 增长，无越界改上游。
- 本次不做：付费/下单、用 sk_key 调模型翻译、temp_token 反向 SSO（跳官网付费免登）、极验人机校验（留在官网侧）。

## Testing

- 会员会话：存/读/清一致性、schema 校验、独立 key 与上游隔离、迁移链。
- cookie watcher：set 触发接管、续期（overwrite）不误判登出、精确 name 匹配、removed 触发清态、多标签/误触。
- 凭据自取：显式头装配（凭据+平台头+7段UA）、开户轮询可续与补偿、未授权收敛清态、后端域缺失 fail-fast。
- key 注入：登录单写 sk_key、设置页只读展示、登出清空、与 seed/更新模型并发不丢 key。
- mock 替身：mock 后端强校验凭据头（不认自动 cookie）、真态切 env 零改代码、path 形状与真态一致。
- popup 账户：未登录显登录入口、已登录显手机号、fork 菜单替换 better-auth、空 key 门禁引导登录。
