## Context

本仓的正式包配置是**单点的**：`.env.production`（force-add，随仓公开）是唯一配置源，`wxt build/zip` 在 production 模式下自动读它。`scripts/pack.mjs` 已有两个维度——打包意图（`test` / `store`，经 `FORK_PACK` 注入）与渠道（`--channel`，经 `WXT_FORK_CHANNEL` 注入），但**没有地区维度**。

三条既有机制是本设计的落点：

1. **子进程 env 注入**：`pack.mjs test` 模式已经在用「读一份 dotenv 文件 → `spawnSync` 的 `env` 参数注入 → 优先级盖过 `.env.production`」。第二套正式配置沿用同一条路，不引入新机制。
2. **构建期静态替换**：`WXT_FORK_CHANNEL` 由 Vite 在编译期替换 `import.meta.env.WXT_FORK_CHANNEL`，绕开 t3-env schema，保住软 fork 边界（不改 `src/env/`）。edition 走同一血统。
3. **产物域名断言**：`assert-fork-build.mjs` 从 `.env.production` 反推「必须出现的域名」，再扫产物文本比对。加了第二份 env 后，这个"反推"必须改成按 edition 取，否则海外包会因为找不到 `.cn` 域名而误判失败。

软 fork 边界约束：净新增代码进 `src/fork/**`（C 类，零成本）；`wxt.config.ts` 是 B 类、已在 `scripts/fork-allowlist.json` 白名单内；`scripts/pack.mjs`、`scripts/assert-fork-build.mjs` 是 fork 自建脚本，不受上游同步影响。

## Goals / Non-Goals

**Goals:**

- 一条命令打出指向 `.com` 的海外正式包，且配置错误在**构建期**暴露，而不是等用户登录才发现。
- 两条线的域名互斥断言：海外包不含 `.cn`、国内包不含 `.com`。
- 国内线现有命令与产物**逐字不变**——不传 edition 即国内，产物域名、渠道号、manifest 与本变更前一致。
- 四条对外跳转路径收敛到单一真源，按 edition 解析，不在调用点散落硬编码。

**Non-Goals:**

- 不做账户菜单的邮箱身份与订阅状态展示（独立需求）。海外包的账户菜单本期仍走手机号字段，取不到值即空。
- 不做海外商店条目的素材、截图、开发者账号——非代码工作。
- 不引入第三个 edition，也不为此预留插件式注册机制。两条线就写两条线。
- 不改上游 `src/env/shared.ts` 的默认值与 schema；不给 t3-env 加 fork 字段。
- 不修国内线 `WXT_WEBSITE_URL` 用裸域导致的 cookie 读取隐患（已知问题，另行排查）；海外线直接配 `www` 域绕开。

## Decisions

### D1：第二份正式配置用独立文件 + 子进程注入，不改 env schema

海外配置落 `.env.global.production`，与 `.env.production` 同规格、同样 force-add 进仓（`.gitignore` 里 `.env.*` 对二者一律无效）。`pack.mjs` 在 `--edition global` 时解析该文件，把键值经 `spawnSync` 的 `env` 注入子进程——优先级高于 WXT 自动读的 `.env.production`，实现覆盖。

**为什么不选**「在 `src/env/shared.ts` 里加 edition 分支」：那是上游 A 类文件，每次同步 take-theirs，改了必然被冲掉。
**为什么不选**「一份 env 里放两套前缀变量」：运行时要多一层选择逻辑，且断言脚本无法再靠"文件里有什么域名"反推预期值。

海外配置的初始取值：官网域已确定（`https://www.translatebuff.com`，取实际部署的 `www` host——裸域是只做 301 的 nginx）；登录后端域与翻译网关域**以官网域占位**，上线前替换为后端正式值。占位而非留空，是因为 `assert-fork-build.mjs` 对空的 `WXT_RENYIMIAO_API_URL` 已经 fail-fast。

### D2：edition 单一真源在 `src/fork/identity/edition.ts`，构建期注入

新增模块导出：

```ts
export type ForkEdition = "cn" | "global"
export const DEFAULT_EDITION: ForkEdition = "cn"
export function resolveEdition(raw?: string): ForkEdition // 未知值抛错，空值回落 cn
export function currentEdition(): ForkEdition // 读 import.meta.env.WXT_FORK_EDITION
```

`currentEdition()` **函数内读**而非模块顶层快照——与 `resolveChannelNumber` 同款理由：单测用 `vi.stubEnv` 运行期改它。

`wxt.config.ts` 侧走 `process.env.WXT_FORK_EDITION`（Node 上下文），`resolveEdition` 同一份实现两处共用。

### D3：站点路径表用 TS 常量，不用 JSON

新增 `src/fork/website-routes.ts`：

```ts
export type WebsiteRoute = "login" | "orders" | "uninstallSurvey" | "feedback"
export function websiteRouteBasePath(route: WebsiteRoute): string
```

两条线各一张表。`channels.json` 用 JSON 是因为 Node 侧（`pack.mjs`）与 bundle 侧都要读；路径表**只有 bundle 侧读**，用 TS 常量可拿到联合类型与穷尽检查，比 JSON 更安全。

海外取值：`/login`、`/account/orders`、`/extension/uninstall-survey`、`/help`。
国内取值：`/login`、`/orders`、`/uninstall-survey`、`/feedback`。

多语言前缀仍由既有 `websiteLocalePath(locale, path)` 拼装，前缀在最前——`websiteLocalePath(locale, websiteRouteBasePath("orders"))`。这保证海外线得到 `/zh-hans/account/orders` 而非 `/account/zh-hans/orders`，且登录路径的既有等价不变量不被破坏。

`website-locale.ts` 的映射表**不加** `pt`。该表的方向是「扩展 UI 语言 → 官网 locale」，而扩展没有葡萄牙语界面，加了就是无消费方的死代码。海外官网有 pt、扩展没有，两侧不对称是预期状态，在表的注释里写明即可（表里已有同款先例：扩展有 vi、官网没有）。

### D4：渠道注册表加 `edition` 字段，海外渠道 id 加 `global-` 前缀

`channels.json` 每项从 `{number, browser}` 扩为 `{number, browser, edition}`。现有 8 个渠道全部标 `"edition": "cn"`（显式而非缺省，避免读的人猜）。

新增 4 个海外渠道，id 用 `global-` 前缀与国内同名渠道区分：

| id                    | 用途             | browser | number |
| --------------------- | ---------------- | ------- | ------ |
| `global-zip`          | 官网直装         | chrome  | `7150` |
| `global-chrome-store` | Chrome Web Store | chrome  | `7151` |
| `global-edge`         | Edge Add-ons     | edge    | `7152` |
| `global-firefox`      | Firefox AMO      | firefox | `7153` |

**为什么不用「同 id 不同 edition」的二维键**：`pack.mjs --channel <id>` 的入参就是 id，二维键要么多传一个参数、要么在错误提示里解释"这个 id 有两条"，都比加前缀贵。

海外号码取 `7150–7153`，落在 71 段内：两个官网仓的 `CHANNEL_ID_PATTERN = /^71\d{2}$/` 原样放行，官网侧零改动。段位是跨仓隐式契约——**新增渠道时号码必须留在 71 段内**，否则官网 `normalizeChannelId` 会静默回落 `7100`，插件跳官网的 `?cid=` 归因全量记错且线上零报错。

`resolveChannelNumber(id, registry)` 增加第三重校验（前两重"未知 id"、"号码未分配"保持不变）：渠道 `edition` 与 `currentEdition()` 不符即抛错。默认渠道由常量 `DEFAULT_CHANNEL = "zip"` 改为按 edition 取——`cn → "zip"`、`global → "global-zip"`。

号码未分配（`null`）时的既有行为不变：`--channel` 点名硬报错、`--all` 跳过续跑并在汇总里列名。海外号码到位前，`--edition global --all` 会全部跳过并打印清单——这是正确的失败形态。

### D5：域名断言改为双向

`assert-fork-build.mjs` 现有 `readForkDomainsFromEnv(envText)` 从 env 文本解析 `WXT_API_URL` / `WXT_WEBSITE_URL` 的 host。改动：

- **正向**（必须出现）：读**当前 edition** 的 env 文件解析。
- **反向**（禁止出现）：读**另一 edition** 的 env 文件解析，命中即失败。

两份 env 都在仓内，直接按 edition 选文件路径即可，不需要额外配置。反向断言是本变更最重要的护栏——它拦的是"海外包指向国内后端"这种构建期无声、运行期才炸的失败。

上游域名告警、测试域泄漏守卫、合作方站点注入断言三项保持原样，不随 edition 变化。

### D6：manifest 身份在 `wxt.config.ts` 按 edition 取值

`FORK_BRANDING` 已有两个字段各司其职：`name`（ASCII 技术标识 `TranslateBuff`）与 `displayName`（中文 `任译喵`）。海外线的 manifest `name` 直接复用 `FORK_BRANDING.name`——它本来就是英文品牌名，不新增字段。

```
manifest.name        = edition === "global" ? FORK_BRANDING.name : FORK_BRANDING.displayName
gecko.id             = edition === "global" ? "overseas@translatebuff.com" : "translatebuff@translatebuff.com"
```

**国内 `gecko.id` 保持原值不动**：国内版已在 AMO 上架，而 AMO 的扩展 ID 是该条目的主键、上架后不可更改——改它等于发布成一个全新扩展，存量用户收不到更新。海外线另起 `overseas@translatebuff.com`：Firefox 只要求扩展 ID 形如邮箱地址或 GUID，不做域名所有权校验、也不要求是可收信邮箱，只要与国内值不同即可各自上架，两条线互不影响。

用 `overseas@` 而非 `global@`（代码内 edition id 是 `global`）：`overseas` 与需求仓的既有业务命名一致（`v1-0-0-translatebuff-overseas`），且扩展 ID 一经上架不可改，宁可贴业务语言。edition id 保持 `global` 不动——它是构建期内部键，不外露。

`APP_NAME`（`src/utils/constants/app.ts`）继续等于 `FORK_BRANDING.name`，**不受 edition 影响**——它派生 shadow-host 自定义元素名（`translate-buff`，必须含连字符）、IndexedDB 库名、HTTP 头，随 edition 漂移会崩内容脚本并丢用户数据。

`zip.includeSources` 需同时包含两份 env 文件，否则 Firefox 的 sources 包在海外构建下缺配置。

### D7：`Client-Language` 参数化，映射在纯函数里

新增 `src/fork/membership/client-language.ts`：

```ts
export const DEFAULT_CLIENT_LANGUAGE = "en-us"
export function toClientLanguage(uiLocale: string): string
```

映射表只收官网侧已实测确认后端有译文的取值，与官网 `toBackendLanguage` 同一份内容：`en→en-us`、`zh-CN→zh-cn`、`zh-TW→zh-tw`、`ja→ja-jp`、`ru→ru-ru`；其余一律回落 `en-us`。**不猜** `es-es` / `ko-kr` 这类未经实测的取值——后端查不到译文时不回退英文，直接把字面量 `err not found` 当错误消息返回给用户看。

调用链改造走**显式参数透传**，不引入模块级可变状态、不给 `api.ts` 加 storage 依赖（它是纯 fetch 层、单测直接调）：

```ts
buildAuthHeaders(loginCredential, clientLanguage = DEFAULT_CLIENT_LANGUAGE)
authedGet(pathname, loginCredential, clientLanguage?)
fetchLoginStatus(loginCredential, clientLanguage?)
fetchTokens(loginCredential, clientLanguage?)
fetchTokensWithRetry(loginCredential, options?)   // options 增加 clientLanguage?: string
```

映射发生在 `src/fork/background/membership.ts` 的 `adoptCredential()`——那里本来就要读 config（`applyConfigPatch` 已在读），取 `config.uiLanguage` → `resolveUiLocale`（归一 `"auto"`）→ `toClientLanguage`，一次算出后透传。

国内中文界面结果仍是 `zh-cn`，与现状一致；国内非中文界面由恒定 `zh-cn` 变为对应 locale，是修正不是回归。

### D8：反馈 URL 由 env + 路径表解析

`src/fork/ui/options/featurebase.ts` 里写死的 `https://www.translatebuff.cn/feedback` 删除，改为 `getWebsiteUrl(websiteRouteBasePath("feedback"))`。元数据参数拼装逻辑不动。

反馈链接**不加 `cid`**——它不是转化入口，加了只会污染归因。登录 / 订单 / 卸载问卷三条继续 `appendChannelId`。

## 文件结构

**新建（全部 C 类，`src/fork/**` 内零 allowlist 成本）**

| 文件                                                    | 职责                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `src/fork/identity/edition.ts`                          | edition 类型、解析、当前值读取——单一真源                      |
| `src/fork/identity/__tests__/edition.test.ts`           | 未知值抛错 / 空值回落 / stubEnv 运行期读取                    |
| `src/fork/website-routes.ts`                            | 四条对外路径按 edition 的基础路径表                           |
| `src/fork/__tests__/website-routes.test.ts`             | 两条线各四条路径的取值锁定                                    |
| `src/fork/membership/client-language.ts`                | UI locale → `Client-Language` 映射                            |
| `src/fork/membership/__tests__/client-language.test.ts` | 收录值逐条 + 未收录回落 + 取值不含 `/`                        |
| `.env.global.production`                                | 海外正式配置（force-add，随仓公开，只放客户端本就能拿到的值） |

**修改**

| 文件                                      | 改动                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `src/fork/identity/channels.json`         | 每项加 `edition`；新增 4 个 `global-*` 渠道                                |
| `src/fork/identity/channel.ts`            | `ChannelEntry` 加 `edition`；解析加 edition 校验；默认渠道按 edition       |
| `src/fork/membership/atoms.ts`            | 登录 / 订单 URL 改走 `websiteRouteBasePath`                                |
| `src/fork/background/uninstall-survey.ts` | 卸载问卷 URL 改走 `websiteRouteBasePath`                                   |
| `src/fork/ui/options/featurebase.ts`      | 删硬编码 URL，改 `getWebsiteUrl` + 路径表                                  |
| `src/fork/membership/api.ts`              | `Client-Language` 由常量改参数，四个函数透传                               |
| `src/fork/background/membership.ts`       | `adoptCredential` 算出 clientLanguage 并透传                               |
| `wxt.config.ts`                           | manifest `name` / `gecko.id` 按 edition；`includeSources` 加第二份 env     |
| `scripts/pack.mjs`                        | 新增 `--edition`；按 edition 选配置源、圈渠道范围、注入 `WXT_FORK_EDITION` |
| `scripts/assert-fork-build.mjs`           | 正向断言按 edition 取源；新增反向"另一线域名"断言                          |
| `.env.example`                            | 补 `.env.global.production` 与 edition 的说明（B 类，已在 allowlist）      |
| `CLAUDE.md` / `FORK_GUIDE.md`             | 常用命令补 edition 用法                                                    |

## 接口契约

```ts
// src/fork/identity/edition.ts
type ForkEdition = "cn" | "global"
const DEFAULT_EDITION: ForkEdition
function resolveEdition(raw?: string): ForkEdition
function currentEdition(): ForkEdition

// src/fork/website-routes.ts
type WebsiteRoute = "login" | "orders" | "uninstallSurvey" | "feedback"
function websiteRouteBasePath(route: WebsiteRoute): string

// src/fork/membership/client-language.ts
const DEFAULT_CLIENT_LANGUAGE: string
function toClientLanguage(uiLocale: string): string

// src/fork/identity/channel.ts（签名不变，语义扩展）
interface ChannelEntry {
  number: string | null
  browser: string
  edition: ForkEdition
}
function resolveChannelNumber(id?: string, registry?: Record<string, ChannelEntry>): string
```

跨仓契约（不由本仓单方改动）：7 段 UserAgent 第 4 段渠道号、`Login-Credential` cookie 名、官网 locale 前缀规则。

## 命令契约

```
node scripts/pack.mjs test                                    # 不变：本地 .env 测试包
node scripts/pack.mjs store --channel <id>                    # 不变：缺省 cn
node scripts/pack.mjs store --all                             # 不变：缺省 cn，只打 cn 渠道
node scripts/pack.mjs store --edition global --channel <id>   # 新增
node scripts/pack.mjs store --edition global --all            # 新增，只打 global 渠道
```

裸 `store`（无 `--channel` / `--all`）继续硬报错，不因 edition 放宽。

## Risks / Trade-offs

- **两线配置串味是首要失败形态，且症状滞后**——海外包指向国内后端时构建成功、安装可用，直到用户登录才炸。D5 的反向断言是唯一防线；绕过 `pack.mjs` 直接 `wxt zip` 会失去这层保护，`.env.example` 与 `FORK_GUIDE.md` 须写明。
- **渠道号段位是跨仓隐式契约**：官网只认 `/^71\d{2}$/`，段外取值静默回落 `7100`、线上零报错。本次海外号取 `7150–7153` 已避开该坑，但后续任何新增渠道都必须留在 71 段内——这条约束在插件仓看不见，只写在官网 `src/utils/channel.ts` 的注释里。
- **`Client-Language` 映射表覆盖不全**：西班牙语 / 韩语 / 土耳其语界面的海外用户会拿到英文错误消息。这是刻意取舍——回落到已知可用的英文，好过赌一个未经实测的取值把用户打到 `err not found`。后端实测扩表即可，无需改调用方。
- **edition 维度落进 `wxt.config.ts`**：该文件是 B 类原地改，每次同步上游要按 `FORK.md` 对账表逐项比对。改动集中在 manifest 工厂内两行 + `zip.includeSources` 一行，对账成本可控。
- **`.env.global.production` 随仓公开**：与 `.env.production` 同规则——只放客户端解包即可读到的值（后端地址、OAuth client id、分析 ingest key），服务端密钥一律禁止。文件头必须复制同款警告注释。

## Open Questions

1. 海外登录后端域与 oneapi 翻译网关域的正式值——上线前替换，占位期间海外包不可用于真实登录联调。
2. 海外线是否需要独立的 PostHog project 与 Google OAuth client id；当前两份 env 的这两项都是占位，由 CI secrets 注入。
