## Context

要"全局只用任译喵"。现状与关键事实：

- popup 是 fork 壳层（`popup/app.tsx` re-export `src/fork/ui/popup/App.tsx`）。provider 选择链原为上游 composed UI：`ProvidersField → FeatureProviderSelectorList → ProviderSelector`。
- 上游 `ProviderSelector`（`src/components/llm-providers/provider-selector.tsx`）：`getProviderSelectorGroups` 按 `isProviderSelectorItem`/`isLLMProviderConfig`/`isPureTranslateProviderConfig` 分 内置模型/大语言模型/普通翻译 三组；被 **4 处** default import（popup 经 FeatureList、选项 feature-providers-config、自定义指令 provider-field、划词工具栏 footer）。
- 上游选项页：`options/app.tsx`（**allowlist 内**）`lazy(() => import("./pages/api-providers"))`；`api-providers/index.tsx` 相对 import `{ ProvidersConfig } from "./providers-config"`。`ProvidersConfig`（`providers-config.tsx`）= 列表(`ProviderCardList` 含「+ 添加提供商」+ `BuiltInProviderSection` 免费AI) + 编辑器(`ProviderConfigForm`)。
- 免费AI（system provider）`capabilities` 只有 `selectionToolbar.customAction`；默认「词典」自定义动作用它（`createAction(FREE_AI_PROVIDER_ID)`）。
- **seed 竞态 bug**：`background main()` 先 `setupFork()`（异步 sync 写 config），上游 `onInstalled → ensureInitializedConfig → initializeConfig` 在新装时 `buildFreshDefaultConfig()` 并持久化默认配置——两者并发写 config，全新 profile 上默认赢，导致默认 provider 全在、任译喵没 seed。约束：**不能编辑上游 `initializeConfig`**。
- 逻辑函数（复用）：`getSelectableProvidersForCapability`、`buildFeatureProviderPatch`、`FEATURE_KEYS`/`FEATURE_PROVIDER_DEFS`、`RENYIMIAO_ID_PREFIX`/`isRenyimiaoInstance`（fork）。base-ui 原语（复用）：Select/Drawer/Avatar/Field。

## Goals / Non-Goals

**Goals:**

- 全局 provider 选择器只呈现「任译喵 + 普通翻译」。
- 选项页 API 提供商页只有任译喵、不可添加、无内置区（保留列表形态）。
- 全部 fork 自绘 + **零编辑上游源文件**（经 wxt.config resolve 插件重定向）。
- seed 任译喵可靠（避开新装竞态）；被藏 provider 的功能 repoint 任译喵。

**Non-Goals:**

- 不重写 base-ui 原语；不编辑上游 composed UI 源文件；不改上游 `initializeConfig`。
- 不显示"即将上线"行；不新增 api-key 警告；不做登录/会员。
- 不把功能默认翻译源强改为任译喵（保留其现默认；仅 repoint 指向被藏 provider 的项）。

## Decisions

### D1：换皮 + wxt.config Vite resolve 插件全局重定向（零编辑上游）

fork 组件不 import、不编辑上游 composed UI。替换经 `wxt.config.ts` 的自定义 Vite resolve 插件：`resolveId` 命中上游 `provider-selector.tsx` / `providers-config.tsx` 的绝对路径 → 返回对应 fork 文件。相对 import（`./providers-config`、`./pages/api-providers`）也能拦（按解析后绝对路径匹配）。四处选择器 + 选项页全局生效。fork 版 MUST 完整再导出上游被引用的具名导出（如 `ProviderSelector` default、`getProviderSelectorGroups`、`ProvidersConfig`），避免下游 import 断裂。

### D2：fork 选择器只留任译喵组 + 普通翻译组

`getForkProviderSelectorGroups` 只返回 `renyimiao`（置顶）+ `normalTranslator`；丢 `builtInModels`（藏免费AI）+ `llmModels`（藏其它 LLM）。空组过滤、空态 placeholder+disabled。任译喵组内去「任译喵 」前缀（仅展示）。

### D3：fork popup provider 块

summary + Drawer + 功能行（`buildFeatureProviderPatch`）+ 自定义动作行（`setConfig({selectionToolbar:{...展开, customActions}})`）；不显 api-key 警告。已实现，随 D2 分组收敛。

### D4：fork 选项页 provider 页锁定（列表形态）

fork `src/fork/ui/options/providers-config.tsx` 导出 `ProvidersConfig`：保留列表(左栏)+编辑器(右侧)布局，但列表**只任译喵一项**、**无「添加提供商」**、**无「内置提供商」区**；右侧配置任译喵的 API Key + 模型（baseURL 固定只读/隐藏）。用 base-ui + config atoms + `getSelectableProvidersForCapability`，不 import 上游 `providers-config`/`ProviderConfigForm`。经 resolve 插件替换上游。

### D5：seed 改 UI 挂载 + seed-only + 词典 repoint

seed 移出后台（避竞态），改在 fork popup / 选项页挂载时幂等执行（读最新 config，post-init）。`computeForkConfigSync` 简化为 seed-only（删掉"移除默认 provider"——UI 已藏）。seed 时把指向被藏 provider（免费AI）的功能/自定义动作 repoint 到任译喵（词典：免费AI → 任译喵）。`src/fork/background/index.ts` 去掉 racy 的后台改配置调用。

## 文件结构与接口契约

**新增（C 类）:**

- `src/fork/components/provider-selector-groups.ts`：`getForkProviderSelectorGroups`（只 2 组）。
- `src/fork/components/provider-selector.tsx`：fork `ProviderSelector`（default）+ 再导出 `getProviderSelectorGroups`（供 resolve 替换后下游具名 import 不断）。
- `src/fork/ui/popup/providers-field.tsx`：fork popup provider 块（+ 挂载 seed）。
- `src/fork/ui/options/providers-config.tsx`：fork `ProvidersConfig`（只任译喵、无添加、无内置；+ 挂载 seed）。
- seed helper（`ensureRenyimiaoSeeded(config, setConfig)`：幂等补齐 + 词典/被藏项 repoint）。

**修改（fork 文件 + allowlist）:**

- `src/fork/ui/popup/App.tsx`：import fork providers-field（已改）。
- `src/fork/providers/renyimiao.ts`：`computeForkConfigSync` → seed-only；导出 seed helper/谓词。
- `src/fork/background/index.ts`：移除 racy 后台 config 同步。
- `wxt.config.ts`（B 类 allowlist）：加 Vite resolve 插件重定向两个上游文件。

## Risks / Trade-offs

- **resolve 插件对上游重构敏感**：上游若改这两个文件的路径/导出/结构，fork 版需手动跟（换皮脱钩成本）。→ 具名导出保持对齐；同步时 diff 这两文件。
- **上游 4 处调用方的 props 契约**：fork 选择器 props MUST 完全对齐上游，否则某调用方传参失配。→ 逐一核对 4 处用法。
- **seed 竞态**：改 UI 挂载后避开新装竞态；但用户从不打开 popup/选项页则不 seed（可接受：不打开也不用）。
- **脱钩**：fork 选择器/选项页/popup 块此后不跟上游更新。

## Open Questions

- 选项页任译喵配置的确切字段（是否显示只读 baseURL、是否含"测试连接"）——实现时按最小可用定，可迭代。
