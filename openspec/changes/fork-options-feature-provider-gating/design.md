# 技术设计：fork-options-feature-provider-gating

## Context

任译喵网关模型（如 Deepseek-V4-Flash）首装即 seed 进 `providersConfig`，seed 时共享 key 为空；登录后由后台 `/v1/tokens` 注入真 key。key 为空时该模型不可用（点它翻译必失败）。

- **popup 面已门禁**：宿主 `src/fork/ui/popup/providers-field.tsx` 内，key 为空时过滤任译喵项；过滤后为空或当前选中即任译喵时改显登录引导；`ForkProviderSelector` 的 `SelectValue` render 已加 null 守卫防孤儿 value 崩溃。
- **选项页「通用」页未门禁**：渲染链 `options/pages/general/feature-providers-config.tsx`（上游 wrapper）→ `FeatureProviderSelectorList`（上游宿主 `src/components/llm-providers/feature-provider-selector-list.tsx`）→ `ProviderSelector`（已被 wxt.config 重定向到 fork `ForkProviderSelector`）。宿主用 `getSelectableProvidersForCapability` 未过滤、只有上游缺 key 警告，无门禁、无 fork 版。
- 已核实：该上游宿主导出 `FeatureProviderSelectorList` + `needsApiKeyWarning`（`feature-providers-config.tsx` 从同模块具名导入这两个）；重定向后另一 importer（上游 popup `providers-field.tsx`）是死代码（popup 入口已顶替为 fork App）。选项页树经 sidebar `UserAccountMenuSidebar`（`useForkSession`）hydrate 了 `forkSessionAtom`，「通用」页同 store 可读。

## Goals / Non-Goals

**Goals:**

- 选项页「通用」页功能提供商在无可用 key 时对任译喵施加与 popup 一致的门禁（隐藏 + 无其它可选时改显登录引导）。
- 把 popup 与选项页共用的门禁判定收敛为单一 fork 逻辑，两面复用、单点维护、单点测试。
- 选项页「通用」页挂载时确保任译喵 seed 就位，与 popup / 选项页「API 提供商」页对齐。

**Non-Goals:**

- 不改 seed / repoint 配置逻辑；门禁仅展示层过滤，实例仍在 config 中。
- 不编辑上游源文件、不改上游 config schema / 后端门禁。
- 本变更不覆盖 translation-hub / 划词工具栏（各自独立下拉，其树不 hydrate session；留待后续，避免范围蔓延）。
- 不改 popup 顶部登录横幅与其它既有行为（DRY 抽取为行为等价替换）。

## Decisions

### D1：宿主级门禁 + 构建期重定向（不下沉进选择器组件）

选项页功能提供商宿主换皮为 fork 版 `src/fork/ui/options/feature-provider-selector-list.tsx`，经 `wxt.config.ts` 的 `FORK_UI_REDIRECTS` 顶替上游同名模块。**不**把门禁下沉进已 fork 的 `ForkProviderSelector`：缺 key 警告挂在宿主 `FieldLabel` 上、选择器无法复现该布局；且会把会员态（session/login）耦合进本应纯展示的选择器；translation-hub 用的是另一个下拉，选择器并非通用 choke point；下沉还会改动已工作的 popup、引入回归。宿主级门禁与 popup 一致，是正解。

### D2：`needsApiKeyWarning` 走上游 re-export，不复刻

fork 宿主 `export { needsApiKeyWarning } from "@/components/llm-providers/feature-provider-selector-list"`。`wxt.config.ts` 的 `forkUiRedirectPlugin` 有自引豁免（当 importer 正是重定向目标文件时不重定向），故 fork 宿主 import 上游同名模块时解析到真·上游、不自环。fork 宿主 **MUST 同时导出** `FeatureProviderSelectorList` 与 `needsApiKeyWarning`（上游活文件 `feature-providers-config.tsx` 从同模块具名导入这两个，缺一构建挂）。`needsApiKeyWarning` 为纯函数，re-export 零漂移，复刻反而制造重复。

### D3：DRY —— 抽共享门禁 hook + 共享 Fallback 组件

新增共享 fork 位 `src/fork/ui/providers/renyimiao-gating.tsx`：

- **hook** `useRenyimiaoGatedProviders(capability, selectedId)`：内部读 `providersConfig`，返回 `{ providers, showFallback }`。
  - `gated = renyimiaoApiKey(providersConfig) === ""`
  - `providers = gated ? all.filter(p => !isRenyimiaoInstance(p)) : all`（`all = getSelectableProvidersForCapability(capability, providersConfig)`）
  - `showFallback = gated && (providers.length === 0 || isRenyimiaoInstance({ id: selectedId }))`
- **组件** `RenyimiaoGatedFallback`：内部自取 `forkSessionAtom` + `useOpenForkLogin`，无 prop 透传；`session` 存在显「获取中」占位，否则显登录按钮。

popup 的 `FeatureRow`（`capability=featureKey, selectedId=providerId`）与 `CustomActionRows`（`capability="selectionToolbar.customAction", selectedId=action.providerId`）改为消费该 hook + 组件；选项页 fork 宿主的两类行同样消费。抽取只动每行门禁逻辑，**不碰** popup 顶部登录横幅与 `useEnsureRenyimiaoSeeded()`（正交）。

### D4：选项页 fork 宿主补 `useEnsureRenyimiaoSeeded()`

seed 现只在 popup 与选项页「API 提供商」页挂载时触发；「通用」页原为上游、不 seed。fork 宿主 MUST 在挂载时调用 `useEnsureRenyimiaoSeeded()`，与另两处对齐，堵住首装直开「通用」页时门禁前置缺失的功能缺口。

### D5：fork 宿主 1:1 换皮，保留完整 props 面

fork 宿主保持薄壳（门禁逻辑在 D3 的共享 hook），但 MUST 与上游宿主对齐以下点，防行为漂移：

- props 面完整：`className` / `providerSelectorClassName`（默认 `"w-full"`）/ `providerSelectorTriggerSize`（默认走选择器默认值 `"default"`，**非** popup 的 `"sm"`）/ `includeCustomActions`（默认 `true`）/ `renderApiKeyWarning`。
- `renderApiKeyWarning` 仍挂 `FieldLabel` 内、label 文案之后（feature 行传 `providerConfig`、custom action 行传各自 `currentProviderConfig`）——非任译喵缺 key 仍走它。
- FieldLabel 结构差异（feature 行 `render={<div className="flex flex-wrap"/>}`、custom action 行 `render={<div/>}`）、custom actions 空列表 `return null`、非空带段头 + placeholder i18n key。
- 直接 `import ForkProviderSelector from "@/fork/components/provider-selector"`（不绕上游路径）。

### 文件结构与接口

| 操作 | 文件                                                        | 职责                                                                                                                                 |
| ---- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A    | `src/fork/ui/providers/renyimiao-gating.tsx`                | 共享门禁 hook `useRenyimiaoGatedProviders` + `RenyimiaoGatedFallback` 组件                                                           |
| A    | `src/fork/ui/providers/__tests__/renyimiao-gating.test.tsx` | 共享 hook 单测（过滤 / fallback 判定各分支）                                                                                         |
| A    | `src/fork/ui/options/feature-provider-selector-list.tsx`    | fork 宿主换皮：导出 `FeatureProviderSelectorList` + re-export `needsApiKeyWarning`，消费共享 hook/组件、`useEnsureRenyimiaoSeeded()` |
| M    | `src/fork/ui/popup/providers-field.tsx`                     | `FeatureRow`/`CustomActionRows` 改用共享 hook/组件，删本地 `RenyimiaoGatedFallback` 与 session 透传                                  |
| M    | `wxt.config.ts`                                             | `FORK_UI_REDIRECTS` 增一条 `feature-provider-selector-list.tsx` → fork 版                                                            |

**接口契约：**

- `useRenyimiaoGatedProviders(capability: ProviderCapability, selectedId: string): { providers: ProviderSelectorOption[]; showFallback: boolean }`
- `RenyimiaoGatedFallback: React.FC`（无 props，自取 atom/hook）
- fork 宿主 `export function FeatureProviderSelectorList(props): JSX.Element` + `export { needsApiKeyWarning } from "上游同名模块"`，props 面与上游一致（见 D5）。

## Risks / Trade-offs

- **死代码耦合**：重定向后上游 popup `providers-field.tsx` 仍 import 该模块（死代码，tsc 解析到上游、不走 vite 重定向），反过来把 `providerSelectorTriggerSize`/`includeCustomActions` 等 props 面钉死在 fork 宿主上。缓解：D5 完整对齐 props；同步上游时留意此耦合。依 fork 纪律「不删已有死代码」，保留、仅提一句。
- **同步维护**：多一个 fork 宿主 + 一条重定向，上游改 `feature-provider-selector-list.tsx` 时需跟随同步。缓解：宿主保持薄壳（门禁在共享 hook）、结构 1:1 对齐降低漂移面。
- **测试覆盖空缺**：vitest 不走 vite 重定向，现有 `feature-provider-selector-list.test.tsx` 测的是上游宿主且 mock 掉 selector，不覆盖 fork 门禁；popup 门禁此前亦无测试。缓解：D3 共享 hook 补单测兜住两面判定（含上次孤儿 value 崩溃的选中即任译喵分支）。
- **孤儿 value 双保险**：`ForkProviderSelector` 的 null 守卫（独立防线）+ 宿主「选中即任译喵→fallback」（UX 层）正交叠加；选项页 custom actions 单选是 popup 多选的子集，无新增死角。
