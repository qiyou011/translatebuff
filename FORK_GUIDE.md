# Translatebuff 开发指南

> Translatebuff 是 [read-frog](https://github.com/mengxi-ream/read-frog) 的**软 fork**：我们重做 UI、自建会员与登录，但持续复用并同步上游的翻译引擎。
>
> 本文是面向开发者的**上手 + 日常协作**指南。追求可读性；操作细节的权威清单在 [`FORK.md`](./FORK.md)，能力规格在 [`openspec/specs/`](./openspec/specs/)。

---

## 目录

1. [心智模型](#1-心智模型)
2. [每次同步上游怎么做](#2-每次同步上游怎么做)
3. [哪些文件避免改动（红黄绿分区）](#3-哪些文件避免改动红黄绿分区)
4. [后续开发落在哪些文件](#4-后续开发落在哪些文件)
5. [常见任务速查](#5-常见任务速查)
6. [护栏与命令](#6-护栏与命令)
7. [红线（不变量）](#7-红线不变量)
8. [已知事项与坑](#8-已知事项与坑)

---

## 1. 心智模型

一句话：**净新增代码全进 `src/fork/**`；上游引擎照单全收；两者之间只留极少数受控接缝。**

同步之所以便宜，是因为本仓 `main` 与 `upstream/main` **共享 Git 提交祖先**（`main` 就是上游提交的镜像起点）。只要坚持 `merge`（绝不 `rebase`/`squash`），三方合并成本就一直很低。

每个文件都落入四类之一：

```
┌─────────────────────────────────────────────────────────────┐
│  A 绝不改   上游高频热点 → 改了必冲突 → 一律 take-theirs        │
│  B 原地改   fork 必须改的极少数上游文件 → 每次同步手工解冲突    │
│  C fork 新增 src/fork/** 等 → 上游永不碰 → 零冲突               │
│  D 直接同步  其余全部（引擎）→ merge 自动带入，无需干预         │
└─────────────────────────────────────────────────────────────┘
```

**开发时的黄金法则**：想加东西？先问“能不能只写在 C 类？” 绝大多数情况都能。

---

## 2. 每次同步上游怎么做

按上游发版（`chore(release): version packages` 提交）或每周一次，任选其一先到。

```bash
# 1. 拉上游
git fetch upstream

# 2. 开同步分支（绝不在 main 上直接合）
git switch -c sync/$(date +%Y-%m-%d) main

# 3. 合并（只 merge，绝不 rebase/squash）
git merge upstream/main

# 4. 解冲突 —— 正常只会落在 B 类文件；A 类一律 take-theirs：
#    git checkout --theirs <A类文件> && git add <A类文件>

# 5. 重生成 lockfile（绝不手工合并 pnpm-lock.yaml）
pnpm install

# 6. 全绿门禁
pnpm run test
pnpm run build && pnpm run build:edge && pnpm run build:firefox
node scripts/assert-fork-build.mjs
FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs

# 7. PR: sync/* -> main（CI fork-guard.yml 会复跑第 4/5/6 步）
```

> 💡 `git config rerere.enabled true` 已开启，重复的冲突解法会被记住，第二次同步同一处会自动套用。

**期待值**：健康的一次同步，冲突要么没有，要么只在少数 B 类文件里、且每处只需保留 fork 的那几行。若冲突落到了 A 类，说明有人不小心改了热点文件——回去把它挪进 `src/fork/`。

---

## 3. 哪些文件避免改动（红黄绿分区）

### 🔴 A 类 · 绝不改（take-theirs）

改了几乎必然与上游冲突，且这些是上游每个版本都在动的高频文件。

| 文件                                                   | 为什么碰不得                                       |
| ------------------------------------------------------ | -------------------------------------------------- |
| `src/utils/message.ts`                                 | UI↔background 唯一契约 `ProtocolMap`，几乎每版都变 |
| `src/types/config/**`、`src/utils/constants/config.ts` | 配置 zod schema + `DEFAULT_CONFIG`                 |
| `src/utils/config/migration-scripts/**`                | 配置迁移链，一版一文件                             |
| `src/utils/constants/models.ts`、`providers.ts`        | 模型/供应商清单，随模型发布频繁变                  |
| `package.json` 的 `version`、`CHANGELOG.md`            | 上游发版重写；fork 发版号另走（见 §5）             |
| `pnpm-lock.yaml`、`.changeset/**`                      | lock 用 `pnpm install` 重生成；changeset 休眠不删  |

> `.changeset/**` 的「不删」只针对**上游写的** changeset（take-theirs 休眠即可）。**fork 自己不要新写 changeset**——fork 永不跑 `changeset version`，写了也不会被消费，只会长期挂在差集里当噪音。fork 发版走 §5。

**冲突解法**：`git checkout --theirs <file>`。fork 要扩能力 → 一律另写到 `src/fork/`。

### 🟡 B 类 · 允许原地改（受 allowlist 管控）

fork 无法回避、必须原地改的极少数上游文件。真源清单见 [`scripts/fork-allowlist.json`](./scripts/fork-allowlist.json)，**增项需评审**。当前实际改动 5 个：

| 文件                                             | fork 改了什么                                          |
| ------------------------------------------------ | ------------------------------------------------------ |
| `wxt.config.ts`                                  | manifest `name` / `version`(4 段) / Firefox `gecko.id` |
| `src/entrypoints/background/index.ts`            | `main()` 内加一行 `setupFork()`                        |
| `src/utils/constants/app.ts`                     | `APP_NAME` 指向 `FORK_BRANDING.name`                   |
| `src/entrypoints/popup/app.tsx`                  | 缩为壳层，re-export `src/fork/ui/popup/App`            |
| `src/entrypoints/background/uninstall-survey.ts` | 卸载调研 URL 指向 fork 站点                            |

> allowlist 里还**预留**了 options/sidepanel/translation-hub/side/selection 的 `app.tsx`、`selection.content/index.tsx`、auth/orpc client、9 个 locale——留给后续 UI 重建 / 会员替换时用。

**冲突解法**：手工合并，保留 fork 那几行，其余接受上游。

**原则：allowlist 放行的是「非改不可的那几行」，不是整个文件的自由处置权。**

同一个文件里，改动落在哪个位置决定了它将来是零成本还是永久成本：

- **改上游既有结构**（在上游已有的段/对象/数组里增删条目）——上游此后每动一次那个结构，都要人工解一次冲突，且冲突会散布到所有同类文件上。
- **整段新增**（新起一个 fork 自有的顶层段/常量/导出）——上游永远不会碰它，三方合并自动通过。

**能整段新增就绝不插进上游结构**。典型如多语言文案：fork 要加的 key 一律进 fork 自建命名空间，绝不塞进上游既有的段——哪怕语义上看着更"该"放在那儿。语义归属的一点别扭是一次性的，冲突是每次同步都要还的。

**自检**：改完后跑一次 `git diff upstream/main -- <文件>`，差异应当只有两类——品牌类字面替换、以及成段的 fork 新增。出现"在上游段内部穿插几行"就是放错了位置，挪出来。

### 🟢 C 类 · fork 净新增（零冲突）

上游永远不会创建这些，所以永远不冲突。**新功能优先都写这里。**

```
src/fork/**                        # fork 所有代码
scripts/check-fork-boundary.mjs    # 边界 CI
scripts/assert-fork-build.mjs      # 域名断言
scripts/fork-allowlist.json        # B 类白名单
FORK.md / FORK_GUIDE.md            # 文档
.env.production                     # 后端指向
.github/workflows/fork-guard.yml   # CI
openspec/**                         # 规格/变更
```

### 🔵 D 类 · 直接从上游同步（take upstream）

其余全部 = 引擎，`merge` 自动带入，无需干预。

- `src/utils/host/translate/**`（翻译引擎）、`src/entrypoints/background/`（除 `index.ts`）、content-scripts 注入逻辑、`src/utils/`、`src/hooks/`、未 fork 的 `src/components/` 等。
- **npm 包引擎**：`@read-frog/definitions`、`@read-frog/api-contract` —— **升版本号即同步**（take 上游 `package.json` + `pnpm install`）。升级前请 diff 其常量（`AUTH_BASE_PATH` / `ORPC_PREFIX` / `AUTH_COOKIE_PATTERNS` / orpc 形状），防契约漂移。

---

## 4. 后续开发落在哪些文件

**统一原则：门禁/权限全放服务端，扩展当瘦客户端。** 登录、会员、自定模型三样，扩展侧几乎全落 `src/fork/`（C 类），零碰 A 类。

### fork 目录约定

```
src/fork/
├── message.ts            # 独立 ForkProtocolMap（fork 专属消息，绝不进上游 message.ts）
├── branding.ts           # 品牌名 + 站点 URL（域名占位，后续换）
├── background/index.ts   # setupFork()：fork 所有后台接线的唯一入口
├── identity/             # fork 自主 semver（version.ts + fork-version.json）
├── config/               # fork 专属配置：独立 storage key + schema + 迁移链
├── membership/           # ← 会员/登录客户端（待建）
├── providers/            # ← fork 侧 provider 展示覆盖（待建，可选）
├── components/           # ← fork 设计系统 / 账户菜单（待建）
└── ui/<page>/App.tsx     # ← 各页面 fork 界面（popup 已有参考页）
```

### 账户登录

| 做什么   | 落点                                                                                                                        | 类   |
| -------- | --------------------------------------------------------------------------------------------------------------------------- | ---- |
| 认证机制 | v1 保 better-auth；`.env.production` 已指向你后端。中国大陆登录（手机/短信/微信）= better-auth 插件装在**服务端**，扩展不动 | 零改 |
| 会话     | 后端实现 `AUTH_BASE_PATH` + 设匹配 `AUTH_COOKIE_PATTERNS` 的 cookie；`backgroundFetch` 自动带 cookie 绕 CORS                | 零改 |
| 账户 UI  | 新建 `src/fork/components/account/*` 替代 `src/components/user-account-menu/*`                                              | C    |

> 彻底弃 better-auth 时，才在上游 client 文件里原地 `export * from '@/fork/membership/...'`（B 类）——v1 不需要。

### 会员体系

- 会员等级是**服务端事实**，扩展只读、不判权。
- `src/fork/membership/api.ts`：用 `backgroundFetch` 打 `api.translatebuff.com/membership` 拉等级（**不要**扩 `@read-frog/api-contract`，fork 自己的 fetch 客户端）。
- `src/fork/membership/atom.ts`：会员态 jotai atom，fork UI 读它决定显不显示 pro 功能。
- `src/fork/config/schema.ts`：已有 `membership.tier`，按需扩展。**绝不**把会员字段塞进上游 `configSchema`。
- ⚠️ 扩展里的门禁只用来“灰按钮/引导升级”，**真门禁在服务端**（返回 402/403）。

### 自定模型

- **用户自带模型**：上游**已内建** `openai-compatible` provider（baseURL + key）。白拿，只需在 `src/fork/ui` 做更好看的配置界面（消费既有 config atom，**不碰** provider schema）。
- **你的托管/会员模型**：**不要**改 `SYSTEM_PROVIDER_DEFS` / `isFreeAiProviderId` / `background-stream.ts`（上游高频，必冲突）。改用**网关法**：
  1. 托管模型 = 一个 `openai-compatible` provider，`baseURL = https://api.translatebuff.com/v1`。
  2. 会员登录后后端签发 per-user token，fork onboarding 自动填入该 provider 配置。
  3. 网关按 token/会员等级校验（非 pro → 429/403）。门禁全在服务端，扩展复用上游 local-provider 直连路径，一行上游不改。

### UI 重建

- 每个页面：把上游 `app.tsx` 缩为 2 行壳层，re-export `src/fork/ui/<page>/App`（popup 已示范）。
- fork 屏幕**只消费** atoms（读态）+ `sendMessage`/ProtocolMap（触发引擎）+ shadow-host（挂载），**不直接读**上游 zod schema。
- 内容脚本只换 shadow-host 内层 React，DOM/注入逻辑留上游。
- `main.tsx` **不是**纯骨架（popup/main.tsx 带页面 atoms）——改每页 `main.tsx` 或抽 `src/fork` helper，二选一。

> 🔴 **红线（2026-08-25 用户明确要求）**：**禁止为视觉定制原地编辑任何上游 UI 文件**。所有 fork 视觉与交互定制一律走 `src/fork/**` 影子壳 + `FORK_UI_REDIRECTS` 重定向。
>
> 代价是实测过的：一次 155 文件的原地换肤提交，独自贡献了 110 个越界文件里的 109 个，直接把合并上游 v1.46.4 的冲突从 12 个推到 34 个。存量复测用 `FORK_SCAN_ALL=1 node scripts/check-fork-boundary.mjs`（排查用，不参与 CI 判定）。
>
> ⚠️ **反冲突铁律（2026-07-22 同步教训）**：重度定制的**整块 surface**（popup ✓、翻译浮窗、被重刷的选项页）一律走「re-export shim + fork 壳（C 类）」，**绝不在 churning 共享文件上原地改**（`main.tsx` / `app.tsx` / `theme.css` / 共享组件都是上游高频文件，原地改 = 上游每次动它就冲突）。
>
> - **禁改名共享上游组件做品牌化**：品牌化要「fork 包一层」，绝不重命名上游组件。曾把 `frog-toast` → `brand-toast`，上游随后用 base-ui toast 重构该组件 → 正面冲突、fork 改名白做（该次同步 9 个冲突全源于此）。
> - **藏 vs 定制**：只想**藏**单个上游叶子组件 → `FORK_UI_REDIRECTS` 重定向到 fork 空组件（一次性够用）；想**定制整块** → fork 壳里「按需渲染、不要的不渲染」，比逐个重定向更省、更抗冲突（翻译浮窗即按此规划）。

---

## 5. 常见任务速查

**加一段 fork 后台逻辑** → 写进 `src/fork/background/index.ts` 的 `setupFork()`；fork 消息用 `src/fork/message.ts` 的 `ForkProtocolMap`。上游 `background/index.ts` 永远只有那一行 `setupFork()`。

**加一个 fork UI 页** → `src/fork/ui/<page>/App.tsx` 写界面 → 上游 `entrypoints/<page>/app.tsx` 缩成 `export { default } from "@/fork/ui/<page>/App"`（把该 `app.tsx` 加进 allowlist）。

**加 fork 专属配置项** → 改 `src/fork/config/schema.ts`（独立 storage key），**绝不**动上游 `configSchema`。

**接自定/会员模型** → 用 `openai-compatible` provider 指向你的网关，门禁在服务端（见 §4）。

**改品牌** → 改 `src/fork/branding.ts`（name / websiteUrl）。`APP_NAME` 与 manifest 名已从这里派生。

**fork 发版** → 改 `src/fork/identity/fork-version.json` 的 `version`（fork 自主 semver，如 `1.0.0`→`1.0.1`）。manifest version 直接取它、与上游版本解耦；version_name 保留上游溯源「任译喵 1.0.0（rf <上游版本>）」。打测试 / 正式包见 FORK.md B1（`node scripts/pack.mjs test|store`）。**绝不**在 fork 上跑 `changeset version`。

---

## 6. 护栏与命令

```bash
pnpm dev                      # 开发（自动开 Chrome 装载扩展）
pnpm run preview:watch        # UI 预览：持续增量编译并自动刷新插件
pnpm run test                 # 单元测试（vitest）
pnpm run build                # chrome 构建
pnpm run build:edge           # edge 构建
pnpm run build:firefox        # firefox 构建
pnpm run type-check           # oxlint 类型检查
node scripts/assert-fork-build.mjs                              # 断言产物里 fork 域名生效
FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs  # 断言无越界（allowlist 外改动）
```

- **边界检查** `check-fork-boundary.mjs`：任何落在 `src/fork/**` / 白名单前缀 / `fork-allowlist.json` 之外的改动都会判越界失败。这是防止误改 A 类的机械护栏。
- **域名断言** `assert-fork-build.mjs`：从 `.env.production` 派生 fork 域名，确认它们进了产物（= env 覆盖生效，没被 shell 残留 `WXT_*` 顶掉）；残留上游域名只告警。
- **CI** `.github/workflows/fork-guard.yml`：在 PR 上复跑边界检查 + 三浏览器构建 + 域名断言，是兜底。

---

## 7. 红线（不变量）

1. **只 merge，绝不 rebase/squash `main` 上的上游提交** —— 否则毁掉共享祖先，此后每次合并都变贵。
2. **所有净新增代码进 `src/fork/**`**。
3. **A 类一律 take-theirs**；fork 扩展只进 C 类。
4. **fork 配置独立 storage key + schema + 迁移链**，绝不触碰上游 `configSchema`。
5. **lockfile 用 `pnpm install` 重生成**，绝不手工合并。
6. **门禁/权限在服务端**，扩展只读会员态、不做安全边界。

---

## 8. 已知事项与坑

- ~~**popup 目前很空**~~ **（2026-08-25 已过期）**：`src/fork/ui/popup/App.tsx` 现在是完整壳层——账号菜单、语言选择、provider、翻译模式、站点开关、快捷键、博客入口都在，并复用多个上游 popup 组件。`MoreMenu` 与 `DiscordButton` 不在其中，所以上游的 Discord / 微信 / GitHub / 商店评价入口对 fork 用户天然不可达。
- **本地 `.env` 会让部分上游测试失败**：dev 用的 `.env` 若覆盖 `WXT_WEBSITE_URL`，会让上游 guide/官方源相关测试挂。CI 不带 `.env`（用默认值）所以照常绿。需要指向 fork 后端做本地联调时再临时创建 `.env`，跑测试前移除。
- **`free-api.test.ts` 偶发失败**：它打真实 Google/Microsoft 翻译 API，遇 429 限流会挂——环境性，非本仓引入。
- **产物里仍有 `readfrog.app` 字样**：是 `src/env/shared.ts` 的默认回退字面量 + 尚未重建的 UI 链接。**运行时 active 后端已是 fork**（env 覆盖生效），这些是死字面量，`assert-fork-build.mjs` 只告警不拦。完整 UI 重建时清理。
- **`WXT_GOOGLE_CLIENT_ID` 是 prod 必填**：v1 仅中国大陆登录、不上 Google。当前 `.env.production` 用占位值满足校验；正式弃 Google 登录时改走 `WXT_SKIP_ENV_VALIDATION` + analytics stub（后续会员变更定夺）。
- **扩展身份**：`name=Translatebuff`、`version=1.40.2.0`（4 段）、Firefox `gecko.id=translatebuff@translatebuff.com`。Chrome 商店 ID 由首次上架分配，`chrome.identity` OAuth client 要绑那个 ID（onboarding checklist）。
