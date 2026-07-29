## Context

渠道号是后端做来源归因的跨仓契约固定值，当前硬编码 `UA_CHANNEL = "7100"`（`src/fork/membership/api.ts:23`），塞进 7 段 UserAgent 第 4 段。任译喵将同时上架 Chrome 商店 / Edge / Firefox 并保留官网 zip 直装，各市场须上报**各自渠道号**；同时扩展跳官网登录、卸载问卷的链接也需携带 `cid` 供官网归因。

约束：软 fork 边界——净新增进 `src/fork/**`（C 类零 allowlist），`scripts/**` 与 `docs/**` 豁免，`wxt.config.ts` 在白名单内可改，**`package.json` 不可改**（不在白名单/豁免前缀，改动触发越界）。WXT 已注入 `import.meta.env.BROWSER`，且 `import.meta.env.WXT_*` 会被 Vite 编译期静态替换（`api.ts` 现有 `WXT_RENYIMIAO_API_URL` 血统）。打包统一入口是 `scripts/pack.mjs`（现 `test|store`、仅 chrome）。

## Goals / Non-Goals

**Goals:**

- 每个市场产物携带各自渠道号，贯通"UA 上报"与"官网 cid 跳转"两条链路。
- 单一真源登记渠道，Node（打包）与 bundle（运行）双端消费不重复。
- 三层护栏杜绝"错误渠道号静默发包"。
- 支持单渠道补打与一键全渠道正式包；全程零软 fork 越界。

**Non-Goals:**

- 不做运行时渠道探测（扩展无原生层，渠道必须构建期烤死）。
- 不改上游 config schema / DEFAULT_CONFIG / migration / providers / models / message（红线）。
- 不改 `package.json`（不加 npm 脚本，构建入口全落 `scripts/`）。
- 不在扩展侧做归因落库/上报逻辑（那是后端与官网的事）。
- 本变更不负责后端号码分配与官网 cid 读取（跨仓外部前置）。

## Decisions

### D1：渠道正交于浏览器，用显式选择器，不用 `import.meta.env.BROWSER`

同一个 chrome 构建要能产出 `zip`(7100) 与 `chrome-store`(另一号) 两个渠道，浏览器维度分不开二者。故引入独立渠道 id 选择器，浏览器目标交给 WXT。**否决**"BROWSER 直接映射渠道"方案。

### D2：单一真源用 JSON（`src/fork/identity/channels.json`），非 `.ts`

注册表须被 **Node 侧 `pack.mjs`**（`readFileSync`+`JSON.parse` 读 `browser` 段推导 `-b`）与 **bundle 侧 `channel.ts`**（读 `number` 段）双端消费。`.ts` 无法被 Node ESM 直接 import；JSON 双端可读，落 `src/fork/identity/`（与 `fork-version.json` 同规格）。两消费点读不同字段，无重复、无反向依赖。

### D3：env 只传渠道 id（人类可读键），号码在 bundle 侧解析

`WXT_FORK_CHANNEL` 注入的是 `zip`/`chrome-store` 这类 id，不是号码。号码解析（id→number）单点收敛在 `channel.ts::resolveChannelNumber()`，复用 `api.ts` 既有 `import.meta.env.WXT_*` 编译期替换血统、绕 t3-env 保边界；函数内读非模块顶层快照（对齐 `api.ts` 约定，单测 `vi.stubEnv`）。

### D4：三层护栏

1. **解析期**：`resolveChannelNumber()` 对未知 id / 号码为 `null` 即抛错。
2. **打包期**：`pack.mjs store` 强制显式 `--channel`/`--all`，裸 `store` fail-loud（7100 默认只保留在 dev 裸 `pnpm zip`）；`--channel <null号码渠道>` 硬报错；`--all` 对 `null` 渠道跳过续跑。
3. **构建期**：`assert-fork-build.mjs` 增断言——若 `WXT_FORK_CHANNEL` 已设则其解析号码必须非 `null`，把"运行期首个请求才崩"前移到构建期，封死绕过 `pack.mjs` 直接 `wxt zip` 的路径。

### D5：cid 与 UA 同源，收敛为通用助手 `appendChannelId(url)`

cid 值 = `resolveChannelNumber()`（与 UA 段4 同一号）。用 `URL` API 追加 `?cid=`（稳健处理已有 query 与 fragment，query 落在 fragment 前，官网 `location.search` 可读）。登录（`atoms.ts`，干净路径）与卸载（`uninstall-survey.ts`，`getWebsiteUrl`）两出口统一调用；未来新出口一行接入。

### D6：正式包产物名按渠道 id

`wxt.config.ts` 的 `artifactTemplate` 读 `process.env.WXT_FORK_CHANNEL`：已设→`translatebuff-<版本>[-test]-<渠道id>.zip`（自描述、`zip` 与 `chrome-store` 不撞车）；未设→回退 `-{{browser}}.zip`（dev 行为不变）。

### D7：浏览器目标从注册表推导

`pack.mjs` 按渠道 id 从 `channels.json` 取 `browser` 段决定 `wxt zip -b <browser>`，使用者只说渠道、不手填浏览器，消除"渠道/浏览器填错配"。

## 数据模型 / 接口契约

**`src/fork/identity/channels.json`**（单一真源）：

```json
{
  "zip": { "number": "7100", "browser": "chrome" },
  "chrome-store": { "number": "7101", "browser": "chrome" },
  "edge": { "number": "7102", "browser": "edge" },
  "firefox": { "number": "7103", "browser": "firefox" }
}
```

- `number`: 后端分配的渠道号字符串（后端「渠道标识(ID)」）；新增渠道若号码未分配以 `null` 占位（护栏拦截）。
- `browser`: WXT 构建目标（`chrome`/`edge`/`firefox`）。
- 溯源：7100 任译喵-OFFICIAL_WEB · 7101 任译喵-Google · 7102 任译喵-Edge · 7103 任译喵-FireFox。

**`src/fork/identity/channel.ts`** 导出：

- `resolveChannelNumber(id?: string): string` — 入参默认取 `import.meta.env.WXT_FORK_CHANNEL`；未设→`"7100"`（默认渠道 `zip`）；未知 id 或 `number===null`→throw。
- `appendChannelId(url: string): string` — 追加 `cid=resolveChannelNumber()`，用 `URL` API 合并既有 query/fragment。
- `DEFAULT_CHANNEL = "zip"`（供脚本与测试引用，避免魔法串）。

**`scripts/pack.mjs`** CLI 契约（在既有 `test|store` 上扩展）：

- `store --channel <id>`：读 `channels.json`→推导 browser→`WXT_FORK_CHANNEL=<id> wxt zip -b <browser>`→`assert-fork-build`+`check-fork-brand`；`number===null`→硬报错。
- `store --all`：遍历渠道；已分配→打包+断言，`null`→打印跳过续跑；真实失败才 fail-fast；结尾汇总。
- `store`（裸）：报错退出，要求显式渠道。

## Risks / Trade-offs

- **跨仓依赖未就位**：三个市场渠道号未分配前，其正式包被 `--all` 跳过 / `--channel` 硬报错——可用但不可发对应市场包，需推动后端分配。官网未读 `cid` 前，cid 已挂但归因不生效——需推动官网协同。**缓解**：`null` 占位 + 护栏使"未就位"显式暴露而非静默错误。
- **bundle 内联整张注册表（含所有渠道号）**：渠道号非密钥、非安全边界，可接受，无需拆分。
- **localhost hash 路由边界**：dev 态 `getWebsiteUrl` 返 `host#/path`，`URL` API 把 cid 落 `search`（`host/?cid=x#/path`）——生产路径路由正常、卸载仅真实触发，dev 非归因场景，无实质问题。
- **回滚**：改动全在 `src/fork/**`+`scripts/**`+`wxt.config.ts`，`git revert` 即恢复硬编码 7100，无迁移、无存量数据牵连。

## Open Questions

- ~~**订单页是否需 cid**~~：**已确认需要**（转化/支付按渠道归因）。`useOpenForkOrders` 已补 `appendChannelId`，cid 出口为登录/订单/卸载三处。
- **cid 参数名与取值口径**：本设计按"渠道号"取值、参数名 `cid`，需与官网 `translatebuff-web` 对齐确认。
- **号码分配时点**：`chrome-store`/`edge`/`firefox` 号码何时由后端给出，决定各市场包可发时间。
