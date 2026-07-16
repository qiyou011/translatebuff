## ADDED Requirements

### Requirement: 换皮边界与零编辑上游重定向

系统 SHALL 遵循「换皮」约定：provider 选择相关 UI 全部 fork 自绘，**复用**上游逻辑函数（`getSelectableProvidersForCapability`、`buildFeatureProviderPatch`、provider 谓词）与 base-ui 原语，**MUST NOT** 编辑上游 composed UI 源文件（`provider-selector.tsx`、`providers-config.tsx`、`feature-provider-selector-list.tsx`、上游 popup `providers-field.tsx`），也 MUST NOT 在 fork 组件里直接 import 它们。上游 composed UI 到 fork 版的替换 SHALL 通过 `wxt.config.ts` 中的自定义 Vite resolve 插件（按解析后的绝对路径重定向）完成，全局生效。

#### Scenario: 零编辑上游源文件

- **WHEN** 执行 `FORK_DIFF_BASE=origin/change/fork-foundation node scripts/check-fork-boundary.mjs`
- **THEN** 无越界；上游 `provider-selector.tsx`/`providers-config.tsx`/`feature-provider-selector-list.tsx`/上游 popup `providers-field.tsx` 均未被编辑

#### Scenario: resolve 插件全局重定向

- **GIVEN** `[数据层]` `wxt.config.ts` 注册了 fork 的 Vite resolve 插件
- **WHEN** 任一处 import 解析到上游 `provider-selector.tsx` 或 `providers-config.tsx` 的绝对路径
- **THEN** 被重定向到对应 fork 版；四处选择器与选项页均使用 fork 实现

### Requirement: fork 选择器只呈现任译喵与普通翻译

系统 SHALL 提供 fork 版 provider 选择器（base-ui `Select`），分组 MUST 仅保留「任译喵组」（`renyimiao-` 前缀、置顶）与「普通翻译组」（纯翻译 provider，如 Microsoft/Google）；MUST NOT 呈现「大语言模型组」（隐藏 OpenAI/DeepSeek/Atlas 及用户自建 LLM）与「内置模型组」（隐藏免费AI）。空组过滤；props 对齐上游选择器（供 resolve 插件全局替换）。任译喵组内展示名去「任译喵 」前缀（仅展示层）。

#### Scenario: 只出两组

- **GIVEN** `[数据层]` `providers` 含任译喵实例、其他 LLM、纯翻译 provider、免费AI system item
- **WHEN** `[UI层]` 渲染下拉
- **THEN** 只出「任译喵组」（置顶）与「普通翻译组」；其他 LLM 与免费AI 不出现

#### Scenario: 空态兜底不崩

- **WHEN** `[数据层]` 可选 provider 为 0，或 `value` 在 `providers` 中失配
- **THEN** trigger 显示 placeholder（0 项时 disabled），不抛错、不空白

### Requirement: fork popup provider 块

系统 SHALL 提供 fork 版 popup provider 块（summary + Drawer + 功能行 + 自定义动作行），复刻上游行为：summary 取数同 `getSelectedProviderOptions`（功能 + 自定义动作并计）；功能行写回 `buildFeatureProviderPatch`，自定义动作行写回 `setConfig({ selectionToolbar: { ...config.selectionToolbar, customActions } })`（展开保留同级字段）；对齐现状不显示 api-key 警告。`src/fork/ui/popup/App.tsx` 采用此 fork 版。

#### Scenario: popup 采用 fork provider 块

- **WHEN** 构建后打开 popup 并展开 provider Drawer
- **THEN** 由 fork provider 块渲染；各行选择器只呈现任译喵+普通翻译（经 fork 选择器）

### Requirement: fork 选项页锁定为任译喵

系统 SHALL 提供 fork 版选项页 API 提供商页（`ProvidersConfig`），保留列表形态（左栏列表 + 右侧配置），但 MUST 仅呈现任译喵 provider、MUST NOT 呈现「添加提供商」入口、MUST NOT 呈现「内置提供商 / 免费AI」区。右侧配置至少提供 API Key 输入与模型选择（baseURL 固定、只读或隐藏）。经 resolve 插件全局替换上游 `ProvidersConfig`。

#### Scenario: 选项页只有任译喵、不可添加

- **WHEN** `[UI层]` 打开选项页「API 提供商」
- **THEN** 列表只有任译喵一项；无「添加提供商」按钮；无「内置提供商」区；右侧可配置任译喵的 API Key 与模型

### Requirement: 任译喵 seed 可靠化与被藏 provider repoint

系统 SHALL 在 UI 挂载时（fork popup / 选项页）幂等 seed 任译喵实例——读最新 config、缺则补齐，运行于上游 `initializeConfig` 之后以避开新装竞态。`computeForkConfigSync` SHALL 简化为 seed-only（不再从 config 移除默认 provider——UI 已隐藏）。指向被 UI 隐藏 provider（免费AI）的功能/自定义动作（如默认「词典」），SHALL 在 seed 时 repoint 到任译喵，避免选择器中呈现失配空值。

#### Scenario: 新装可靠 seed

- **GIVEN** `[数据层]` 全新 profile、config 已由上游初始化为默认
- **WHEN** `[UI层]` fork popup 或选项页挂载
- **THEN** 任译喵实例被幂等补齐进 `providersConfig`；再次挂载不重复补齐

#### Scenario: 词典 repoint 到任译喵

- **GIVEN** `[数据层]` 默认「词典」自定义动作 `providerId` 指向免费AI（已被 UI 隐藏）
- **WHEN** seed 执行
- **THEN** 其 `providerId` 被 repoint 到任译喵实例
