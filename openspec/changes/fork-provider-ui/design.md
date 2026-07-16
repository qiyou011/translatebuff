## Context

要"全局只用任译喵"，且任译喵网关多模型、需 per-feature 各选模型。现状与关键事实：

- popup 是 fork 壳层（`popup/app.tsx` re-export `src/fork/ui/popup/App.tsx`）。provider 选择链原为上游 composed UI：`ProvidersField → FeatureProviderSelectorList → ProviderSelector`。
- 上游 `ProviderSelector`（`src/components/llm-providers/provider-selector.tsx`）：`getProviderSelectorGroups` 按 `isProviderSelectorItem`/`isLLMProviderConfig`/`isPureTranslateProviderConfig` 分 内置模型/大语言模型/普通翻译 三组；被 **4 处** default import（popup 经 FeatureList、选项 feature-providers-config、自定义指令 provider-field、划词工具栏 footer）。
- 上游选项页：`options/app.tsx`（**allowlist 内**）`lazy(() => import("./pages/api-providers"))`；`api-providers/index.tsx` 相对 import `{ ProvidersConfig } from "./providers-config"`。`ProvidersConfig`（`providers-config.tsx`）= 列表(`ProviderCardList` 含「+ 添加提供商」+ `BuiltInProviderSection` 免费AI) + 编辑器(`ProviderConfigForm`)。
- **每个功能只存 `providerId`**（`c.translate.providerId` / `c.videoSubtitles.providerId` / `c.selectionToolbar.features.translate.providerId` / `c.inputTranslation.providerId`），**无独立模型字段**——翻译用哪个模型由 provider 的 `model.customModel` 决定。故「per-feature 各选模型」在数据层**必须每模型一份 provider 实例**承载。
- openai-compatible 的模型字段：schema 强制 `model.isCustomModel = true`，真实模型 id 存 `model.customModel`，`model.model` 为字面量 `"use-custom-model"`。上游「更新模型」逻辑 = `fetch(${baseURL}/models, Bearer)` 取 id 列表（临时、不持久化）。上游连接检测 = `executeTranslate("Hi", …)` 真发一次翻译探测。
- 免费AI（system provider）`capabilities` 只有 `selectionToolbar.customAction`；默认「词典」自定义动作用它（`createAction(FREE_AI_PROVIDER_ID)`）。
- **seed 竞态 bug**：`background main()` 先 `setupFork()`（异步 sync 写 config），上游 `onInstalled → ensureInitializedConfig → initializeConfig` 在新装时 `buildFreshDefaultConfig()` 并持久化默认配置——两者并发写 config，全新 profile 上默认赢，导致默认 provider 全在、任译喵没 seed。约束：**不能编辑上游 `initializeConfig`**。
- 逻辑函数（复用）：`getSelectableProvidersForCapability`、`buildFeatureProviderPatch`、`FEATURE_KEYS`/`FEATURE_PROVIDER_DEFS`、`executeTranslate`/`getTranslatePrompt`、`extractErrorMessage`、`RENYIMIAO_ID_PREFIX`/`isRenyimiaoInstance`（fork）。base-ui 原语（复用）：Select/Drawer/Avatar/Field/Combobox/Button。

## Goals / Non-Goals

**Goals:**

- 全局 provider 选择器只呈现「任译喵 + 普通翻译」，任译喵组平铺各模型、每功能可各选不同模型。
- 选项页 API 提供商页收成单块「任译喵 API」：API Key 广播、连接检测、更新模型（动态 `/models`）、只读 baseURL；不可添加、无内置区。
- 全部 fork 自绘 + **零编辑上游源文件**（经 wxt.config resolve 插件重定向）。
- seed 任译喵可靠（避开新装竞态）；被藏 provider 的功能 repoint 任译喵；「更新模型」以网关实际为准重建实例集。

**Non-Goals:**

- 不重写 base-ui 原语；不编辑上游 composed UI 源文件；不改上游 `initializeConfig`；不改上游 config zod schema。
- 不显示"即将上线"行；不新增 api-key 警告；不做登录/会员（后端另议）。
- 不把功能默认翻译源强改为任译喵（保留其现默认；仅 repoint 指向被藏/被移除 provider 的项）。

## Decisions

### D1：换皮 + wxt.config Vite resolve 插件全局重定向（零编辑上游）

fork 组件不 import、不编辑上游 composed UI。替换经 `wxt.config.ts` 的自定义 Vite resolve 插件：`resolveId` 命中上游 `provider-selector.tsx` / `providers-config.tsx` 的绝对路径 → 返回对应 fork 文件。相对 import（`./providers-config`、`./pages/api-providers`）也能拦（按解析后绝对路径匹配）；basename 预筛跳过全图无关 import。四处选择器 + 选项页全局生效。构建期 `buildStart` 断言重定向源存在，上游移动/重命名时把静默回落变成响亮报错。fork 版只需 **default 导出**（实测下游对这两个文件均无具名 import 依赖，无需再导出 `getProviderSelectorGroups`）。

### D2：多实例数据模型（每模型一份 provider 实例）

任译喵每个模型 = 一份 openai-compatible 实例（`renyimiao-<modelId>`、name `任译喵 <modelId>`、`customModel = modelId`、共享 baseURL/apiKey）。因功能只存 `providerId`，唯有多实例才能让「网页翻译用 A、划词用 B」在 config 层落地、翻译走对模型。`renyimiao.ts` 提供 `buildRenyimiaoProvider(modelId, apiKey)`、`renyimiaoModelIds`、`renyimiaoApiKey`/`setRenyimiaoApiKey`（读/广播共享 key）、`syncRenyimiaoModels`。

### D3：fork 选择器只留任译喵组 + 普通翻译组、平铺模型

`getForkProviderSelectorGroups` 只返回 `renyimiao`（置顶）+ `normalTranslator`；丢 `builtInModels`（藏免费AI）+ `llmModels`（藏其它 LLM）。空组过滤、空态 placeholder+disabled。任译喵组内**平铺各模型实例**、展示去「任译喵 」前缀（仅展示层，显示模型名）。

### D4：fork popup provider 块

summary + Drawer + 功能行（`buildFeatureProviderPatch`）+ 自定义动作行（`setConfig({selectionToolbar:{...展开, customActions}})`）；不显 api-key 警告。各行选择器经 fork 选择器，任译喵组平铺模型 → 每功能各选。

### D5：fork 选项页收成单块「任译喵 API」

fork `src/fork/ui/options/providers-config.tsx` 导出 `ProvidersConfig`：保留列表+编辑器布局，左栏为**单个合成「任译喵 API」块**（非逐实例）、**无「添加提供商」**、**无「内置提供商」区**。编辑区：API Key（改 → `setRenyimiaoApiKey` 广播到全部任译喵实例）+ **连接检测按钮**（fork `connection-test-button.tsx`：复用 `executeTranslate` 探首个实例）；**「更新模型」按钮**（fork `update-models-button.tsx`：`fetch /models` → 整份回传做实例集同步）；模型清单只读展示；Base URL 只读。用 base-ui + config atoms + fork 逻辑，不 import 上游 `providers-config`/`ProviderConfigForm`。经 resolve 插件替换上游。

### D6：seed 改 UI 挂载 + seed-only + 更新模型动态同步 + repoint

seed 移出后台（避竞态），改在 fork popup / 选项页挂载时经共享 hook `useEnsureRenyimiaoSeeded` 幂等执行（读最新 config，post-init）。`computeForkConfigSync` seed-only（补齐内置可用模型实例、不删默认——UI 已藏）；`syncRenyimiaoModels(config, modelIds)` 以「更新模型」fetch 结果为准重建任译喵实例集（保留同名实例含 key、新模型按共享 key 新建、fetch 里没有的移除，空列表不清空防误清）。`isVisibleProviderId` 按**实际存在**判断，使 seed 与 sync 都能把指向被藏/被移除实例的功能与自定义动作（含默认「词典」）repoint 到存活任译喵实例。`src/fork/background/index.ts` 去掉 racy 的后台改配置调用。

## 文件结构与接口契约

**新增（C 类）:**

- `src/fork/components/provider-selector-groups.ts`：`getForkProviderSelectorGroups`（只 2 组）。
- `src/fork/components/provider-selector.tsx`：fork `ForkProviderSelector`（default），任译喵组平铺模型名。
- `src/fork/ui/popup/providers-field.tsx`：fork popup provider 块（+ 挂载 seed）。
- `src/fork/ui/options/providers-config.tsx`：fork `ProvidersConfig`（单块「任译喵 API」）。
- `src/fork/ui/options/connection-test-button.tsx`：`ConnectionTestButton`（复用 `executeTranslate` 探测，idle/testing/success/slow/failed）。
- `src/fork/ui/options/update-models-button.tsx`：`UpdateModelsButton`（`fetch /models` → `onModelsFetched(modelIds)`）。
- `src/fork/providers/use-ensure-renyimiao-seeded.ts`：`useEnsureRenyimiaoSeeded()`（popup/选项页共享挂载 seed hook）。

**修改（fork 文件 + allowlist）:**

- `src/fork/ui/popup/App.tsx`：import fork providers-field。
- `src/fork/providers/renyimiao.ts`：多实例 `buildRenyimiaoProvider(modelId, apiKey)`；`syncRenyimiaoModels`、`renyimiaoApiKey`/`setRenyimiaoApiKey`、`renyimiaoModelIds`；`computeForkConfigSync` seed-only + repoint；`isVisibleProviderId` 按实际存在判断。
- `src/fork/background/index.ts`：移除 racy 后台 config 同步。
- `wxt.config.ts`（B 类 allowlist）：Vite resolve 插件重定向两个上游文件 + `buildStart` 存在性断言 + basename 预筛。

## Risks / Trade-offs

- **resolve 插件对上游重构敏感**：上游若改这两个文件的路径/导出/结构，fork 版需手动跟（换皮脱钩成本）。→ 已加 `buildStart` 存在性断言；同步上游时 diff 这两文件。
- **上游 4 处调用方的 props 契约**：fork 选择器 props MUST 完全对齐上游，否则某调用方传参失配。→ 逐一核对 4 处用法。
- **共享 key 广播**：任译喵各实例 apiKey 靠 `setRenyimiaoApiKey` 广播保持一致（schema 无法共用一份 key）；改 key 逐字符写 config、未防抖（量级可接受，后续可迭代）。
- **seed 竞态**：改 UI 挂载后避开新装竞态；但用户从不打开 popup/选项页则不 seed（可接受：不打开也不用）。
- **脱钩**：fork 选择器/选项页/popup 块此后不跟上游更新。

## Open Questions

- （已解）选项页含连接检测按钮与「更新模型」按钮；baseURL 只读；模型清单以网关 `/models` 实际为准。
