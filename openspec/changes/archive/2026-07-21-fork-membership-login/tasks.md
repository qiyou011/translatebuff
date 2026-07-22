## 1. env 与 mock 替身（先能本地跑）

- [x] 1.1 `.env`/`.env.production` 新增 `WXT_RENYIMIAO_API_URL`（dev=mock 地址、prod 占位待真后端）；官网域走既有 `WXT_WEBSITE_URL`（dev=mock、prod=translatebuff.com）；另补 dev `WXT_OFFICIAL_SITE_ORIGINS`（watcher 域匹配）
- [x] 1.2 构建期断言：`WXT_RENYIMIAO_API_URL` 缺失即 fail-fast（复用 `assert-fork-build.mjs` 先例，仅校验登录后端域，不碰翻译网关常量）
- [x] 1.3 `scripts/mock-renyimiao/`：静态登录页——点击「模拟登录」用 JS `set` 可读（非 HttpOnly）`Login-Credential` cookie
- [x] 1.4 `scripts/mock-renyimiao/`：mock 后端 `login_status` + `/v1/tokens`，**强制校验 `Login-Credential` 头 + Saas 头 + 7 段 UA**（不认自动 cookie），返参考 envelope `{data:{member:{mobile}}}` / `{data:{tokens:[{sk_key}]}}`（sk_key 固定 `cMDX...280b93`）
- [x] 1.5 mock 启动脚本 + dev 使用说明（README）+ smoke 16/16，确认 mock 不进产物

## 2. 会员会话存储（session.ts）

- [x] 2.1 先写测试：`ForkSession` schema 校验、存/读/清、独立 key 与 better-auth 隔离
- [x] 2.2 `src/fork/membership/session.ts`：`ForkSession={loginCredential,phone,user}` schema + 独立 storage key（隶属 `src/fork/config` 体系）
- [x] 2.3 `loadForkSession/saveForkSession/clearForkSession` + 读取 atom `forkSessionAtom`（atoms.ts），跑绿 2.1

## 3. 平台 API 客户端（api.ts）

- [x] 3.1 先写测试：header 装配（`Login-Credential`+`Saas-Product-Line=AITRANS`+`Saas-App-Id=aitrans-pc`+7 段 `Useragent`+`Client-Language`）、显式带头不依赖 credentials:include
- [x] 3.2 `src/fork/membership/api.ts`：header 装配 + `authedGet` + `fetchLoginStatus` + `fetchTokens`，API base 直读 `import.meta.env.WXT_RENYIMIAO_API_URL`
- [x] 3.3 开户轮询：+3s 起、每 3s、最多 3 次，`sk_key` 非空即停；连续 await 有界重试（不留裸 setTimeout 空闲空档，SW 轮询期保持存活）。**不用 chrome.alarms**（最小 30s 做不了 3s），SW 被杀由挂载补偿兜底
- [x] 3.4 补测试：轮询可续、401 抛出可被上层清态捕获；跑绿

## 4. 后台编排与 cookie 监听（background）

- [x] 4.1 先写测试：cookie 判定——set 接管、`cause==="overwrite"` 不误判登出、name 精确等值、removed 清态
- [x] 4.2 manifest 权限确认：`"alarms"`（上游已具备，无需新增）、`cookies`、`host_permissions` 均已就绪，wxt.config 无需改
- [x] 4.3 `src/fork/background/membership.ts`：`browser.cookies.onChanged` watcher（`OFFICIAL_HOSTS` 常量 + `Login-Credential` 精确匹配），接线进 `setupFork()`
- [x] 4.4 接管编排 `adoptCredential`：读 cookie → `Promise.all(fetchLoginStatus, fetchTokensWithRetry)` → 清态代次守卫 → `saveForkSession` + 单写 key
- [x] 4.5 清态编排 `clearMembership`：removed(`cause!=="overwrite"`) / `forkClearMembership` 消息 / 任一接口 401 → 清 session + `setRenyimiaoApiKey("")`；UI 经 `forkSessionAtom` 响应式回落到未登录态

## 5. sk_key 单写注入与设置页只读

- [x] 5.1 先写测试：后台单写——读一次 config → `ensureRenyimiaoSeeded` → 对全部实例写同一 `sk_key`（写前复读最新数组）→ 写一次；不写 base_url
- [x] 5.2 后台注入实现 `applyConfigPatch`（经 `storageAdapter` 配 `configSchema`，非 writeConfigAtom），跑绿 5.1
- [x] 5.3 `src/fork/ui/options/providers-config.tsx`：任译喵 API Key 字段改只读掩码，**删除 `handleApiKeyChange` 写入路径**；未登录显「登录后自动获取」
- [x] 5.4 挂载对账 `ensureMembershipKey`：popup/选项页挂载若「已登录但 key 空」经 `forkEnsureMembershipKey` 消息补拉重写 key（覆盖 R6 SW 回收致 key 丢失）

## 6. popup 账户菜单与门禁

- [x] 6.1 `src/fork/ui/popup/account-menu.tsx`：fork 自有账户菜单——未登录显登录入口（`getWebsiteUrl`+locale 映射）、已登录显手机号 + 登出（`forkLogout` 删 cookie + `forkClearMembership` 确定性清态）；**替换**上游 `UserAccountMenuPopup`
- [x] 6.2 uiLanguage→官网 next-intl locale 段映射（`website-locale.ts` 纯函数 + 单测）+ 不支持语言回退
- [x] 6.3 空 key 门禁：未登录/key 空时 `providers-field` 顶部登录引导 banner（引导式，不硬阻断上游 TranslateButton——越边界）

## 7. 验证与边界

- [x] 7.1 `SKIP_FREE_API=true pnpm run test` 全绿（1960 passed）；`pnpm run type-check` 退出 0
- [x] 7.2 边界核对：改动全在 `src/fork` / `scripts` / `.env`，wxt.config 未改，零 allowlist 增长
- [x] 7.3 端到端手验：官网 3000 真登录（真手机号+短信）→ 插件 popup 更新为已登录、脱敏手机号展示（用户已验证登录态回传）
- [x] 7.4 切真：`WXT_RENYIMIAO_API_URL` 由 mock 4173 切真测试后端域（值见本地 `.env`，gitignore 不入库）；UA 渠道号由占位 `8188` 对齐官网确认真值 `18790`（`const.ts` CHANNEL_KEY），插件其余代码零改动

## 8. base_url 动态 + 模型列表 + 时序/UI 收尾（迭代扩展）

- [x] 8.1 `api.ts`：`fetchTokens` 补返 `baseUrl`（读顶层 `data.base_url`）；新增 `fetchGatewayModels(baseUrl, skKey)`（`GET {baseUrl}/models` + `Authorization: Bearer <sk_key>`，抽 `UpdateModelsButton` 逻辑复用）
- [x] 8.2 `renyimiao.ts`：`normalizeGatewayBaseUrl`（去尾斜杠 + 幂等补 `/v1`）；`renyimiaoBaseUrl`/`setRenyimiaoBaseUrl`（仿 apiKey 广播）；`buildRenyimiaoProvider`/`syncRenyimiaoModels`/`computeForkConfigSync` 用共享 base_url（回落常量）
- [x] 8.3 `key-injection.ts`：`computeLoginConfigPatch(config, skKey, baseUrl)` 补写 base_url（`setRenyimiaoBaseUrl`）
- [x] 8.4 `background/membership.ts`：`adoptCredential` 顺序两段（先 login_status 写会话、再 tokens 写 key/base_url），新增 `syncGatewayModels` 登录后主动拉一次 `/v1/models`→`syncRenyimiaoModels`（失败降级不阻断）；R6 `ensureMembershipKey` 同步补 base_url + 模型
- [x] 8.5 `ui/options/providers-config.tsx`：`UpdateModelsButton` 与「Base URL」只读框改用动态 base_url（`renyimiaoBaseUrl` 回落常量）
- [x] 8.6 UI 收尾：新增 `phone-mask.ts`（+单测）手机号脱敏、account-menu 套用；`providers-field` 登录引导条条件收敛为「仅未登录」
- [x] 8.7 全 fork 测试绿（13 文件 / 89 测试）+ `pnpm run type-check` 退出 0；改动全在 `src/fork`，零 allowlist 增长
