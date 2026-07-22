## ADDED Requirements

### Requirement: 登录入口与官网跳转

`[UI层]` popup 必须提供任译喵登录入口；未登录时点击该入口，必须打开官网登录页，并按当前界面语言映射官网多语言路径（不支持的语言回退到默认路径）。登录流程本身（手机号 + 短信 + 人机校验）由官网完成，插件不实现登录表单。

#### Scenario: 未登录点击登录入口跳官网

- **GIVEN** 本地无有效会话（forkSession 不存在）
- **WHEN** 用户在 popup 点击「登录」
- **THEN** 插件必须新开标签页打开官网登录页 URL（由 `getWebsiteUrl` 基于官网域拼接）
- **AND** URL 的语言段必须按界面语言映射（如界面 `zh-CN` → 官网 `zh-hans`）；界面语言在官网 locale 空间无对应时回退默认路径

#### Scenario: dev 环境跳向 mock、prod 跳向正式域

- **WHEN** 构建为 dev
- **THEN** 官网域必须取本地 mock 地址；构建为 prod 时必须取 `translatebuff.com`——二者仅由 env 决定，插件代码不区分

### Requirement: 凭据 cookie 监听与接管

`[API层]` 插件后台必须监听官网域上可读凭据 cookie（`Login-Credential`）的变化并据此接管登录/登出，绝不依赖页面回传（postMessage / externally_connectable）。

#### Scenario: 官网登录写 cookie 后后台接管

- **GIVEN** 后台已注册 `browser.cookies.onChanged` 监听
- **WHEN** 官网登录成功、在官网域写入 `Login-Credential` cookie（有效期 30 天）
- **THEN** 后台必须命中该事件（域匹配官网域、cookie 名 **精确等值** `Login-Credential`、`removed=false`）并读取 cookie 值，进入凭据自取流程

#### Scenario: cookie 续期不得误判为登出

- **WHEN** cookie 因续期触发 `removed=true` 且 `cause="overwrite"`
- **THEN** 后台必须忽略该 removed 事件，不得清空会话（登出判定必须要求 `cause !== "overwrite"`）

#### Scenario: 官网登出移除 cookie 触发清态

- **WHEN** 官网登出使 `Login-Credential` cookie 被移除（`removed=true` 且 `cause !== "overwrite"`）
- **THEN** 后台必须清空 forkSession 并把任译喵 provider 的 key 清空

### Requirement: 凭据自取用户信息与密钥

`[API层]` 后台取到凭据后，必须以**显式请求头**携带凭据调用平台接口取回用户信息与 one-api 密钥；绝不依赖 `credentials:include` 自动携带 cookie（以保证 mock 同域与真态跨域走同一代码路径）。

#### Scenario: 显式头装配

- **WHEN** 后台发起平台接口请求
- **THEN** 请求头必须显式包含：`Login-Credential`（cookie 值）、`Saas-Product-Line: AITRANS`、`Saas-App-Id: aitrans-pc`、7 段 `Useragent`（client_name=aitrans-pc）、`Client-Language`
- **AND** 平台 API 基址必须由 fork 直读 `import.meta.env.WXT_RENYIMIAO_API_URL`（不经 t3-env、不改 `src/env/shared.ts`）

#### Scenario: 取用户信息与密钥

- **WHEN** 凭据有效
- **THEN** 后台必须调 `GET /common_bll/v2/member/login_status` 取手机号与用户信息，并调 `GET /claw_bff/v1/tokens` 取 one-api `sk_key`

#### Scenario: 首登开户轮询可续与补偿

- **GIVEN** 首登时后端开户为异步，`/v1/tokens` 首次可能返回空
- **WHEN** `sk_key` 为空
- **THEN** 后台必须按 +3s 起、每 3s 一次、最多 3 次轮询重取，任一次拿到即停；轮询必须**不留裸 `setTimeout` 空闲空档**（事件处理器内连续 await 使 service worker 在轮询期（≤~9s）保持存活）。**不用 `chrome.alarms`**——其最小粒度 30s，无法满足 3s 节奏
- **AND** service worker 仍被回收致后台流程中断时，popup/选项页挂载时若「已登录但 key 空」必须幂等补拉一次（挂载补偿兜底）

#### Scenario: 会话不被开户轮询阻塞（时序解耦）

- **GIVEN** `login_status` 秒回、`/v1/tokens` 因首登开户走轮询（可能 ~9s）
- **WHEN** 后台接管凭据
- **THEN** 后台必须先取 `login_status` 并立即写会话（手机号即时展示），再取 tokens——会话写入不得等待 tokens 轮询完成（禁用会让手机号陪等 tokens 的 `Promise.all` 并行等待）

#### Scenario: 后端域缺失构建期失败

- **WHEN** 构建时 `WXT_RENYIMIAO_API_URL` 缺失
- **THEN** 构建必须 fail-fast（复用 `assert-fork-build` 断言先例），不得让运行时 fetch 到 undefined

### Requirement: 密钥与网关地址单写注入、模型列表主动同步、设置页只读

`[UI层][API层]` 登录得到的 `sk_key` 与网关 `base_url` 必须由后台作为唯一写者注入任译喵 provider 配置；登录后必须主动拉一次模型列表重建实例集；设置页「任译喵 API Key」与「Base URL」字段必须只读展示、不得提供手填写入路径（消除跨上下文并发写覆盖）。

#### Scenario: 登录单写 sk_key 与动态 base_url

- **WHEN** 后台取到非空 `sk_key`
- **THEN** 后台必须先确保任译喵实例已 seed，再以一次读-改-写把 `sk_key` 与 `/v1/tokens` 的 `base_url`（归一到含 `/v1`）写入全部任译喵实例（值一致）；写前必须复读最新配置数组
- **AND** `base_url` 为空时实例 `baseURL` 必须回落网关常量 `RENYIMIAO_GATEWAY_BASE_URL`（仅作登录前默认/缺失兜底）

#### Scenario: 登录后主动拉一次模型列表重建实例集

- **GIVEN** 已取到 `sk_key` 与 `base_url`
- **WHEN** 后台完成 key/base_url 注入后
- **THEN** 后台必须主动 `GET {base_url}/v1/models`（`Authorization: Bearer <sk_key>`——打翻译网关、非平台后端，不带 `Login-Credential`/Saas 头），以返回的 model id 集重建任译喵实例集（保留已有含 key、新增缺失、移除多余、repoint 失效指向）
- **AND** 拉取失败或返回空列表时必须降级不阻断（保留既有静态 seed 实例、不清空），会话/key/base_url 注入不受影响
- **AND** 选项页「更新模型」按钮与后台自动拉取必须共用同一拉取实现（`fetchGatewayModels`），不得各写一份

#### Scenario: 设置页只读展示

- **GIVEN** 已登录
- **WHEN** 用户在设置页查看「任译喵 API Key」
- **THEN** 该字段必须以掩码只读呈现，不得可编辑；必须移除原手填写入路径（`handleApiKeyChange` 写入）
- **AND** 未登录时该字段必须显示「登录后自动获取」并引导登录

#### Scenario: 登出清空 key

- **WHEN** 登出或凭据失效清态
- **THEN** 后台必须把全部任译喵实例的 key 清空

### Requirement: 未授权与一致性收敛

`[API层]` 任一平台接口返回未授权（401）必须触发端到端清态；本地两处存储（fork 会话 + provider 配置）必须在 UI 挂载时做幂等对账自愈。

#### Scenario: 401 端到端清态

- **WHEN** `login_status` 或 `/v1/tokens` 返回 401（凭据过期或失效）
- **THEN** 必须清空 forkSession + 清空 provider key，并在 UI 提示重新登录（作为 cookie removed 漏发的兜底）

#### Scenario: 挂载对账自愈

- **WHEN** popup / 选项页挂载
- **THEN** 若无 forkSession 则 provider key 必须为空、反之必须补齐；部分写失败留下的错配必须被本次对账修正

### Requirement: 会员会话存储

`[存储]` 插件必须使用 fork 独立存储保存登录身份，与上游 better-auth 会话完全隔离，绝不复用上游 session、绝不改上游 config schema。

#### Scenario: 独立存储身份

- **WHEN** 登录成功
- **THEN** 必须把 `{ loginCredential, phone, user }` 写入 fork 独立 storage key（隶属 `src/fork` 会话体系，独立 schema 版本与迁移链）
- **AND** 该存储必须不写入上游 `configSchema`、不复用 `better-auth.session_token`

### Requirement: fork 账户菜单呈现

`[UI层]` popup 必须以 fork 自有账户菜单呈现登录态，替换上游 better-auth 账户菜单，不得并列两套登录语义。

#### Scenario: 登录态呈现（手机号脱敏）

- **WHEN** 存在有效 forkSession
- **THEN** popup 必须显示已登录，手机号必须脱敏展示（保留 `+86-` 前缀 + 首 1 位 + `****` + 后 4 位，如 `+86-13800138000` → `+86-1****8000`），且不得再渲染上游 `UserAccountMenuPopup`（better-auth）

#### Scenario: 登录引导条仅未登录显示

- **WHEN** 无有效 forkSession（未登录）
- **THEN** `providers-field` 必须显示登录引导条；一旦登录（forkSession 存在）该条必须立即隐藏，不得因 sk_key 尚未注入而滞留（避免「已登录仍显示登录引导」的语义矛盾）
- **AND** 空 key 的翻译门禁由选择器侧承担 + R6 挂载补偿自愈，不得以空 key 触发必然失败的翻译调用

### Requirement: 本地 mock 替身与切真

`[dev]` 因官网真登录与后端测试域未就绪，必须提供 dev-only 本地 mock 替身；真态对接必须仅通过切换 env 完成、不改插件代码。

#### Scenario: mock 强校验凭据头

- **WHEN** mock 后端收到 `login_status` / `/v1/tokens` 请求
- **THEN** mock 必须强制校验显式 `Login-Credential` 头 + 平台标识头 + 7 段 UA（**不得**依赖自动携带的 cookie），否则返回未授权——以逼出真态跨域的 header 路径、避免 mock 假绿
- **AND** mock 的 `/v1/tokens` 必须返回固定 `sk_key = sk-mock-renyimiao-0000000000000000000000`

#### Scenario: 切真零改代码

- **WHEN** 官网真登录与后端测试域就绪
- **THEN** 仅把 env 的官网域与 `WXT_RENYIMIAO_API_URL` 从 mock 值换成真值即可对接，插件侧代码不得改动

### Requirement: 软 fork 边界合规

`[约束]` 本变更所有新增/修改必须落在 `src/fork/**`、`scripts/**`、`.env` 内，零 allowlist 增长，无越界改上游文件。

#### Scenario: 边界校验通过

- **WHEN** 运行 fork 边界校验
- **THEN** 不得出现 `src/fork/**` / `scripts/**` / `.env` 之外的改动，且不得新增 `scripts/fork-allowlist.json` 条目
- **AND** 不得改动 `src/utils/message.ts`、config zod schema、better-auth 相关文件
