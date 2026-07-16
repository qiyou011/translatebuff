## ADDED Requirements

### Requirement: 换皮边界与零编辑上游重定向

系统 SHALL 遵循「换皮」约定：provider 选择相关 UI 全部 fork 自绘，**复用**上游逻辑函数（`getSelectableProvidersForCapability`、`buildFeatureProviderPatch`、`executeTranslate`、`extractErrorMessage`、provider 谓词）与 base-ui 原语，**MUST NOT** 编辑上游 composed UI 源文件（`provider-selector.tsx`、`providers-config.tsx`、`feature-provider-selector-list.tsx`、上游 popup `providers-field.tsx`），也 MUST NOT 在 fork 组件里直接 import 它们。上游 composed UI 到 fork 版的替换 SHALL 通过 `wxt.config.ts` 中的自定义 Vite resolve 插件（按解析后的绝对路径重定向）完成，全局生效；构建期 SHALL 断言重定向源存在（上游移动/重命名时报错而非静默回落）。

#### Scenario: 零编辑上游源文件

- **WHEN** 执行 `FORK_DIFF_BASE=origin/change/fork-foundation node scripts/check-fork-boundary.mjs`
- **THEN** 无越界；上游 `provider-selector.tsx`/`providers-config.tsx`/`feature-provider-selector-list.tsx`/上游 popup `providers-field.tsx` 均未被编辑

#### Scenario: resolve 插件全局重定向

- **GIVEN** `[数据层]` `wxt.config.ts` 注册了 fork 的 Vite resolve 插件
- **WHEN** 任一处 import 解析到上游 `provider-selector.tsx` 或 `providers-config.tsx` 的绝对路径
- **THEN** 被重定向到对应 fork 版；四处选择器与选项页均使用 fork 实现

#### Scenario: 重定向源缺失时构建报错

- **GIVEN** `[数据层]` 上游移动或重命名了被换皮的源文件，重定向 `from` 绝对路径失效
- **WHEN** `[API层]` 执行构建（`buildStart`）
- **THEN** 抛出错误指明失效的重定向源，MUST NOT 静默把上游原版 UI 打进产物

### Requirement: 任译喵多模型实例与动态模型同步

系统 SHALL 以**每个模型一份 openai-compatible 实例**（id 前缀 `renyimiao-`、共享网关 `baseURL` 与 `apiKey`、`model.customModel` 为该模型 id）承载任译喵；因每个功能仅存 `providerId`、无独立模型字段，per-feature 各选模型 MUST 靠多实例落地。选项页「更新模型」SHALL `fetch(${baseURL}/models)`（Bearer 共享 key）取模型 id 列表，并以该结果为准**重建实例集**：同名模型实例保留（含其 key）、新模型按共享 key 新建、结果中不存在的模型移除；空结果 SHALL NOT 清空实例集（防误清）。共享 API Key SHALL 经 `setRenyimiaoApiKey` 广播写入全部任译喵实例（非任译喵 provider 不动）。

#### Scenario: 更新模型以网关实际为准重建实例集

- **GIVEN** `[数据层]` 已 seed 内置模型实例，用户已填 API Key
- **WHEN** `[UI层]` 点击「更新模型」，`[API层]` 网关 `/models` 返回 `[Deepseek-V4-Pro, GLM-5.2, Kimi-k2.7]`
- **THEN** `providersConfig` 的任译喵实例集重建为这三个模型（各带共享 key）；非任译喵 provider 保留

#### Scenario: 共享 Key 广播到全部实例

- **GIVEN** `[数据层]` 存在多个任译喵模型实例
- **WHEN** `[UI层]` 在选项页「任译喵 API」块修改 API Key
- **THEN** 全部任译喵实例的 `apiKey` 同步为该值；非任译喵 provider 的 key 不变

#### Scenario: 移除模型时功能 repoint 到存活实例

- **GIVEN** `[数据层]` 某功能 `providerId` 指向任译喵实例 X
- **WHEN** `[UI层]` 「更新模型」结果不含 X 对应模型、X 被移除
- **THEN** 该功能 `providerId` 被 repoint 到一个存活的任译喵实例，不指向已移除项

### Requirement: fork 选择器只呈现任译喵与普通翻译

系统 SHALL 提供 fork 版 provider 选择器（base-ui `Select`），分组 MUST 仅保留「任译喵组」（`renyimiao-` 前缀、置顶）与「普通翻译组」（纯翻译 provider，如 Microsoft/Google）；MUST NOT 呈现「大语言模型组」（隐藏 OpenAI/DeepSeek/Atlas 及用户自建 LLM）与「内置模型组」（隐藏免费AI）。任译喵组内 SHALL **平铺各模型实例**、展示名去「任译喵 」前缀（仅展示层，显示模型名），供每个功能各选不同模型。空组过滤；props 对齐上游选择器（供 resolve 插件全局替换）。

#### Scenario: 只出两组、任译喵组平铺多模型

- **GIVEN** `[数据层]` `providers` 含多个任译喵模型实例、其他 LLM、纯翻译 provider、免费AI system item
- **WHEN** `[UI层]` 渲染下拉
- **THEN** 只出「任译喵组」（置顶、平铺各模型名）与「普通翻译组」；其他 LLM 与免费AI 不出现

#### Scenario: 每功能各选不同模型

- **GIVEN** `[UI层]` popup 各功能行各有一个 fork 选择器
- **WHEN** 网页翻译选任译喵模型 A、划词翻译选任译喵模型 B
- **THEN** 两功能的 `providerId` 分别指向 A、B 实例，翻译各走对应模型

#### Scenario: 空态兜底不崩

- **WHEN** `[数据层]` 可选 provider 为 0，或 `value` 在 `providers` 中失配
- **THEN** trigger 显示 placeholder（0 项时 disabled），不抛错、不空白

### Requirement: fork popup provider 块

系统 SHALL 提供 fork 版 popup provider 块（summary + Drawer + 功能行 + 自定义动作行），复刻上游行为：summary 取数同 `getSelectedProviderOptions`（功能 + 自定义动作并计）；功能行写回 `buildFeatureProviderPatch`，自定义动作行写回 `setConfig({ selectionToolbar: { ...config.selectionToolbar, customActions } })`（展开保留同级字段）；对齐现状不显示 api-key 警告。`src/fork/ui/popup/App.tsx` 采用此 fork 版。

#### Scenario: popup 采用 fork provider 块

- **WHEN** 构建后打开 popup 并展开 provider Drawer
- **THEN** 由 fork provider 块渲染；各行选择器只呈现任译喵（平铺模型）+普通翻译（经 fork 选择器）

### Requirement: fork 选项页收成单块「任译喵 API」

系统 SHALL 提供 fork 版选项页 API 提供商页（`ProvidersConfig`），保留列表+编辑器布局，但左栏 MUST 为**单个「任译喵 API」块**（非逐实例）、MUST NOT 呈现「添加提供商」入口、MUST NOT 呈现「内置提供商 / 免费AI」区。编辑区 SHALL 提供：API Key 输入（修改经 `setRenyimiaoApiKey` 广播到全部任译喵实例）；**连接检测按钮**（复用 `executeTranslate` 对首个任译喵实例真发一次翻译探测，呈现 testing/success/slow/failed）；**「更新模型」按钮**（`fetch /models` 重建实例集）；已同步模型清单（只读）；Base URL（只读）。经 resolve 插件全局替换上游 `ProvidersConfig`。

#### Scenario: 选项页单块、不可添加、无内置区

- **WHEN** `[UI层]` 打开选项页「API 提供商」
- **THEN** 左栏只有单个「任译喵 API」块；无「添加提供商」按钮；无「内置提供商」区；编辑区含 API Key + 连接检测 + 更新模型 + 只读模型清单 + 只读 Base URL

#### Scenario: 连接检测探测网关

- **GIVEN** `[数据层]` 已填 API Key
- **WHEN** `[UI层]` 点击连接检测按钮，`[API层]` 对首个任译喵实例 `executeTranslate("Hi", …)`
- **THEN** 探测中显示 testing；成功显示 success（>3s 为 slow）；失败显示 failed；反馈短暂保留后自动清除

### Requirement: 任译喵 seed 可靠化与被藏 provider repoint

系统 SHALL 在 UI 挂载时（fork popup / 选项页，经共享 hook `useEnsureRenyimiaoSeeded`）幂等 seed 任译喵实例——读最新 config、缺则补齐内置可用模型实例，运行于上游 `initializeConfig` 之后以避开新装竞态。`computeForkConfigSync` SHALL 为 seed-only（不再从 config 移除默认 provider——UI 已隐藏）。`isVisibleProviderId` SHALL 按**实际存在**判断（存在于 config 且为任译喵实例或纯翻译 provider）；指向被 UI 隐藏（免费AI/其它 LLM）或被移除任译喵实例的功能/自定义动作（如默认「词典」），SHALL 在 seed / sync 时 repoint 到存活任译喵实例。

#### Scenario: 新装可靠 seed

- **GIVEN** `[数据层]` 全新 profile、config 已由上游初始化为默认
- **WHEN** `[UI层]` fork popup 或选项页挂载
- **THEN** 内置可用模型的任译喵实例被幂等补齐进 `providersConfig`；再次挂载不重复补齐

#### Scenario: 词典 repoint 到任译喵

- **GIVEN** `[数据层]` 默认「词典」自定义动作 `providerId` 指向免费AI（已被 UI 隐藏）
- **WHEN** seed 执行
- **THEN** 其 `providerId` 被 repoint 到任译喵实例
