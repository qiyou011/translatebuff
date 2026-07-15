## Context

translatebuff-app 是 read-frog 的软 fork，靠 merge-only 同步上游翻译引擎。上游 provider 体系是一套 zod 判别联合 schema（`src/types/config/provider/schemas.ts`），每个 provider 是一个 `provider` 字面量分支——属 A 类高频文件，**新增 provider 类型 = 每次同步必冲突**。

已核实的上游事实（作为本设计的地基）：

- `openai-compatible` 是 schema 既有分支：`baseCustomLLMProviderConfigSchema` 要求 `baseURL: z.string()`，可选 `apiKey`，`model.isCustomModel: z.literal(true)`、`model.customModel: string | null`。
- `LLM_PROVIDER_MODELS["openai-compatible"] = ["use-custom-model"]`，故实例 `model.model` 是**必填枚举**，唯一合法值 `"use-custom-model"`。上游 canonical 形状见 `DEFAULT_PROVIDER_CONFIG["openai-compatible"]`（`src/utils/constants/providers.ts`）。
- provider 实例存于可写 config 字段 atom `configFieldsAtomMap.providersConfig`（`src/utils/atoms/config`）；上游 `addProvider()`（`src/entrypoints/options/pages/api-providers/utils.ts`）即"clone 模板 → append → setProvidersConfig"。
- 翻译源由 `config.translate.providerId`（`src/types/config/translate.ts:101`，`z.string().nonempty()`）指定。
- 品牌：`FORK_BRANDING`（`src/fork/branding.ts`，现 `name:"Translatebuff"`）→ `APP_NAME`（`src/utils/constants/app.ts`）与 popup 头均派生自它。
- 后端地址统一走 `env.WXT_API_URL`（`.env.production` → `api.translatebuff.com`）。
- popup 已是壳层：`src/entrypoints/popup/app.tsx` re-export `src/fork/ui/popup/App`（当前为占位参考页）。
- 边界护栏 `scripts/check-fork-boundary.mjs` 的 `classifyChangedFiles` 现豁免 `src/fork/`、`scripts/`、`docs/`、`FORK.md`、`openspec/`、`.github/`，**未豁免** `FORK_GUIDE.md` / `CLAUDE.md`。

## Goals / Non-Goals

**Goals:**

- 中文显示名"任译喵"用于 manifest 名与 `version_name`；`APP_NAME` 保持 ASCII 技术标识（安全）；Translatebuff 作英文标识。
- 任译喵可用模型各 seed 一个内置实例，作为条目出现在 provider 选择器「大语言模型」组，用户在 网页翻译/字幕/划词/输入/词典 处直接选用；key 在选项页配。
- 隐藏 out-of-box 默认第三方 LLM provider（OpenAI/DeepSeek/Atlas Cloud），产品只暴露任译喵 + 免费 AI + 普通翻译（fork 数据层过滤 + 悬空兜底，不改 A 类 schema）。
- 全部净新增落 `src/fork/**`；零碰 A 类 schema；仅 `wxt.config.ts`（已在 allowlist）改 manifest 名。
- 护栏收口：豁免 fork 自有根文档，使分支可绿。

**Non-Goals（坚决不做，防蔓延）:**

- 不新增 provider 类型、不改上游 provider zod schema / `DEFAULT_CONFIG` / `models.ts` / `providers.ts`。
- 不做登录 / 注册 / 官网 / 购买接口，不做登录后自动注入 key（待接口文档，相关代码不动）。
- 不做会员鉴权门禁（服务端事实，扩展只读、只占位）。
- 不从后端拉模型清单（v1 硬编码 fork 常量）。
- 不改上游 `src/env`（不在 allowlist）。

## Decisions

### D1：任译喵 = 预置 openai-compatible 实例（网关法），而非新增 provider 类型

**为什么不选"新增 renyimiao provider 类型"**：那要改 `src/types/config/provider/schemas.ts`、`models.ts`、`providers.ts` 等 A 类文件，每次上游同步必冲突，违反 fork 红线。

**选定**：把任译喵表达为一个 `openai-compatible` 实例——纯数据进入上游 `providersConfig`，自动融入 provider 选择与翻译引擎，上游引擎零改。oneapi 本身即 openai-compatible 网关，天然契合。

### D2：多实例 seed + 移除 Atlas Cloud，在后台 setupFork 启动时执行

**为什么每模型一实例**：用户诉求是"在 provider 选择器里直接选任译喵支持的模型"。上游选择器按 provider 类型分组、`onChange` 只传 providerId（不带 model），改它需动上游核心组件（7 处引用、常变、同步易冲突）。改用**多 seed 法**：每个可用模型 seed 一个 `openai-compatible` 实例（`id="renyimiao-<modelId>"`、`name="任译喵 <label>"`），零改上游 UI，模型即作为条目出现在「大语言模型」组。代价：无独立置顶的"任译喵"组、"即将上线"占位需后续上选择器方案；多实例时一个 key 需跨实例同步（当前仅 1 可用模型，暂不涉及）。

**为什么放后台**：`syncForkProviders` 放 `setupFork()` 启动时执行，popup 与选项页均由 `storage.watch` 感知，popup 得以保持纯陪读蛙、无 fork 逻辑。同步逻辑幂等（`syncForkProviders` 无变化返回 `null` 免写），保留已存在实例（不覆盖用户已填 `apiKey`）。

**隐藏默认第三方 LLM provider**：同一同步点移除 out-of-box 的 `openai-default` / `deepseek-default` / `atlascloud-default` 实例（产品只暴露任译喵 + 免费 AI + 普通翻译）；仅移除默认 seed 的 `-default` 实例，用户自建的同类 provider（随机 UUID）保留。零改 A 类 schema（类型仍在，仅数据层过滤实例）。

**悬空兜底**：移除 provider 后，用 `FEATURE_PROVIDER_DEFS` + `buildFeatureProviderPatch` 泛型扫描各功能 `providerId`，把指向已移除 provider（或过期任译喵实例）的悬空引用重定向到保留的 `microsoft-translate-default`（免 key），避免 `resolveProviderConfig` 抛错崩溃。默认配置各功能本就指向微软翻译，故全新配置零悬空。同步以 `computeForkConfigSync(config): Partial<Config> | null` 计算整份 config 补丁（providersConfig + 悬空重定向），背景用 `mergeWithArrayOverwrite` 应用。

### D3：实例形状镜像上游 canonical，`model.model` 必填 `"use-custom-model"`

预置实例 MUST 携带 `model:{ model:"use-custom-model", isCustomModel:true, customModel:<默认模型id> }`——漏掉 `model:"use-custom-model"` 会使整份 config zod 校验失败、seed 静默失效。以 `DEFAULT_PROVIDER_CONFIG["openai-compatible"]` 为形状基准，防上游漂移。

### D4：模型清单硬编码 fork 常量；`baseURL` 用 fork 独立常量

模型清单（`label` / 网关 `modelId` / `available`）硬编码于 `src/fork/providers/renyimiao.ts`，仅 `available` 的模型 seed 出实例。网关 `baseURL = "https://open-ai.baomiao.cn/v1"`——它与 `env.WXT_API_URL`（`api.translatebuff.com`，better-auth 后端）**不同域**（oneapi 翻译网关是独立服务），故用 fork 独立常量并注释"不随环境切换"；不改上游 `src/env`（新增 env var 需改 schema，越界）。该常量是公开网关 URL、非密钥。

模型可用性（后台现状）：`Deepseek-V4-Flash`（**大小写敏感，须逐字匹配后台别名**）确认可用；`gpt-5.5`、`qwen3.5-plus` 后台未配置，标 `available:false`（暂不 seed），配好后改一行即启用。

### D5：品牌显示名与技术标识分离（关键安全约束）

审计发现 `APP_NAME` 被上游用作**技术标识**：IndexedDB 库名 `${upperCamelCase(APP_NAME)}DB`（`app-db.ts`）、shadow-host 自定义元素名 `${kebabCase(APP_NAME)}-selection/-side`（`selection.content`/`side.content`）、guide postMessage 源 `${kebabCase(APP_NAME)}-ext`、`X-OpenRouter-Title` HTTP 头、导出文件名。改成中文"任译喵"会：自定义元素名非法 → 内容脚本崩溃；DB 改名 → 老用户数据变孤儿（丢生词本/缓存/配置）。

故 `src/fork/branding.ts` 拆两字段：`name`（ASCII "Translatebuff"，技术标识）+ `displayName`（中文"任译喵"，用户可见）。`APP_NAME = FORK_BRANDING.name` **保持不变**（安全）；中文显示名仅用于 fork 可控露出点：manifest `name`（wxt.config，B 类）+ popup 头（fork 文件，C 类）。sidepanel 标题 / toast / 字幕标题等经 `APP_NAME` 的上游显示点仍显英文——不编辑上游、不扩 allowlist；全中文化留后续独立变更。

### D6：护栏豁免 fork 根文档/根配置

`scripts/check-fork-boundary.mjs` 把 fork 自有/自改的根级 meta 文件收进 `FORK_ROOT_FILES` 集合——在既有 `FORK.md`/`.env.production`/`.env` 之外新增 `FORK_GUIDE.md`、`CLAUDE.md`（fork 净新增文档）与 `.gitignore`（fork 为忽略自有工具文件而改）；配套单测覆盖。这三者原本使 fork-foundation 分支边界检查报红，收口后分支变绿。

### D7：预发布版本号改用 fork 自主 `0.0.x`

现 `computeForkVersion(pkgVersion, forkBuild)` 返回 `pkg.version.forkBuild`（`1.40.2.0`），继承上游号会让新品牌"任译喵"一上来就显 1.40.2，误导用户。正式版前改为 fork 自主 `0.0.<forkBuild>`：

- `computeForkVersion(forkBuild)` 返回 `0.0.${forkBuild}`（数字版本，不含上游号）。上游号仅用于 `version_name` 溯源。
- 新增 `computeForkVersionName(pkgVersion, forkBuild, brandName)` 返回 `${brandName} 0.0.${forkBuild}（rf ${pkgVersion}）`；沿用对 `pkgVersion` 的 3 段合法性校验。
- `fork-build.json` 的 `forkBuildNumber` 由 `0` 改 `1`（首个预发布 `0.0.1`），之后每次 fork 发版 +1。
- `package.json version` 仍 take-theirs（A 类不动）；`wxt.config.ts`（B 类 allowlist）改为调用上述两函数拼 `version` 与 `version_name`。

**为什么不继续 4 段派生**：4 段号强绑上游版本，与"任译喵是新产品、预发布阶段"的语义冲突；`0.0.x` 明确传达"早期版本"，且 `version_name` 保留 `rf 1.40.2` 不丢溯源。

## 文件结构与接口契约

**新增（C 类）:**

- `src/fork/providers/renyimiao.ts`
  - Produces: `RENYIMIAO_ID_PREFIX`、`RENYIMIAO_GATEWAY_BASE_URL`、`HIDDEN_DEFAULT_PROVIDER_IDS`（`openai/deepseek/atlascloud-default`）、`RENYIMIAO_MODELS`（仅 `Deepseek-V4-Flash` available）、`renyimiaoInstanceId(modelId)`、`buildRenyimiaoProvider(model)`、`computeForkConfigSync(config): Partial<Config> | null`（补齐可用模型实例 + 隐藏默认 LLM + 移除过期任译喵实例 + 悬空功能兜底，保留已有 apiKey，无变化返回 null）。
  - Consumes: 上游 `Config`/`ProviderConfig` 类型、`FEATURE_PROVIDER_DEFS`/`buildFeatureProviderPatch`、`isSystemProviderId`。

- `src/fork/ui/popup/App.tsx`（纯沿用上游 popup 完整布局，无 fork 块）
  - Consumes: 上游 popup 全部组件（`@/entrypoints/popup/components/*`、`UserAccountMenuPopup`）、`EXTENSION_VERSION`、`i18n`、`openOptionsPage`。
  - 行为：照搬上游 popup 面板（任译喵模型经后台 seed 出现在 `ProvidersField` 选择器）；仅 footer 版本号取 `EXTENSION_VERSION`（fork 0.0.x）。

**修改:**

- `src/fork/background/index.ts`（C 类）：`setupFork()` 启动时调用 `computeForkConfigSync` 读 storage、`mergeWithArrayOverwrite` 应用补丁后写回（seed 可用模型 + 隐藏默认 LLM + 悬空兜底）。
- `src/fork/branding.ts`（C 类）：新增 `displayName`（中文"任译喵"）；`name` 保持 ASCII 技术标识。
- `src/fork/identity/version.ts`（C 类）：`computeForkVersion` 改返回 `0.0.${forkBuild}`；新增 `computeForkVersionName`。
- `src/fork/identity/fork-build.json`（C 类）：`forkBuildNumber` `0`→`1`。
- `wxt.config.ts`（B 类，已在 allowlist）：manifest `name` 取中文主名；`version`/`version_name` 改调新版本函数。
- `scripts/check-fork-boundary.mjs`（C 类工具）：`FORK_ROOT_FILES` 集合加 `FORK_GUIDE.md`、`CLAUDE.md`、`.gitignore`。

**数据契约（预置实例）:**

```
{ id:"renyimiao-managed", name:"任译喵 API", provider:"openai-compatible",
  enabled:true, baseURL:"https://open-ai.baomiao.cn/v1", apiKey:"",
  model:{ model:"use-custom-model", isCustomModel:true, customModel:"Deepseek-V4-Flash" } }
```

## Risks / Trade-offs

- **模型别名漂移**：下拉的网关 model id 必须与 oneapi 后台别名一致，否则 404/429。→ 常量集中管理 + 上线前对账后台别名。
- **并发写覆盖**：`providersConfig` 走整数组覆盖；seed 与设置页并发编辑存在极窄竞态。→ `ensureRenyimiaoProvider` 内 seed 前复读最新数组再 append；且 seed 仅首开触发。
- **空 key 失败**：未填 key 时翻译失败。→ popup 显式引导，提前暴露失败点。
- **中文主名回退**：英文环境/ASCII 场景不宜用中文。→ 品牌常量拆两字段，各取所需，`gecko.id` 不受影响。
- **护栏收口牵动既有越界项**：`FORK_GUIDE.md`、`.gitignore` 是 fork-foundation 遗留的既有越界。→ 本变更把 fork 自有/自改根文件（含 `FORK_GUIDE.md`/`CLAUDE.md`/`.gitignore`）统一豁免，分支边界检查转绿。

## Open Questions

- ~~网关 `baseURL`~~ 已定：`https://open-ai.baomiao.cn/v1`（fork 独立常量，与 `WXT_API_URL` 不同域）。
- ~~模型别名~~ 部分定：`Deepseek-V4-Flash` 可用（默认，**大小写敏感**）；`gpt-5-mini`、`qwen3.5-plus` 待后台配置后补确切别名。
- 正式版发布时的版本方案（`1.0.0`？恢复上游派生？）待后续决定，本变更仅定预发布 `0.0.x`。
