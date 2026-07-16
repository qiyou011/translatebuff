## ADDED Requirements

### Requirement: 任译喵内置模型多实例 seed

系统 MUST 在后台 `setupFork()` 启动时，为每个**可用**的任译喵模型 seed 一个上游 `openai-compatible` 实例（`id = "renyimiao-<modelId>"`、`name = "任译喵 <label>"`、`customModel = <modelId>`），纯数据写入上游 `providersConfig`，使每个模型作为一项出现在 provider 选择器的「大语言模型」组，可被 网页翻译 / 视频字幕 / 划词翻译 / 输入翻译 / 词典 各功能直接选用。MUST NOT 新增 provider 类型或改上游 provider zod schema / `DEFAULT_CONFIG`。

#### Scenario: 为可用模型补齐实例

- **GIVEN** `[数据层]` `providersConfig` 中缺少某可用模型的任译喵实例
- **WHEN** 后台执行 provider 同步
- **THEN** 为该模型追加一个 `openai-compatible` 实例，`id` 以 `renyimiao-` 前缀派生自 `modelId`

#### Scenario: 保留已存在实例、不覆盖 apiKey

- **GIVEN** `[数据层]` 某任译喵实例已存在且用户已填 `apiKey`
- **WHEN** 后台再次同步
- **THEN** 该实例被原样保留，`apiKey` MUST NOT 被覆盖为空

#### Scenario: 已齐备时免写

- **GIVEN** `[数据层]` 所有可用模型实例已存在、且无隐藏的默认 LLM provider、无过期任译喵实例、无悬空功能
- **WHEN** 同步计算 `computeForkConfigSync(config)`
- **THEN** 返回 `null`，不触发存储写入

#### Scenario: 实例形状通过上游 zod 校验

- **GIVEN** `[数据层]` 上游 `openai-compatible` 的 `model` 为必填枚举 `["use-custom-model"]`
- **WHEN** 预置实例经 `providerConfigItemSchema` 解析
- **THEN** 实例 `model.model` MUST 为 `"use-custom-model"`、`model.isCustomModel` MUST 为 `true`，解析通过

### Requirement: 内置模型清单（硬编码、大小写敏感）

系统 MUST 以 fork 常量硬编码内置模型清单（含 `label` / 网关 `modelId` / `available`），随发版可调；仅 `available` 的模型 seed 出实例。提交给网关的 `modelId` MUST 与 oneapi 后台别名逐字一致（**大小写敏感**）。当前 `Deepseek-V4-Flash` 可用；`gpt-5.5`、`qwen3.5-plus` 标 `available:false`，后台配好后改一行即启用。

#### Scenario: 仅 seed 可用模型

- **WHEN** 后台同步 provider
- **THEN** 仅 `available:true` 的模型被 seed 为实例；`available:false` 的模型不产生实例

### Requirement: 隐藏默认第三方 LLM provider

系统 MUST 在 fork 同步点从 `providersConfig` 移除 out-of-box 的默认第三方 LLM provider 实例——`openai-default`、`deepseek-default`、`atlascloud-default`——使其不出现在 provider 列表与选择器中（产品只暴露任译喵 + 免费 AI + 普通翻译）。仅移除默认 seed 的实例（`-default` id）；用户经「添加提供商」自建的同类 provider（随机 UUID）MUST 保留。MUST NOT 改动 A 类 provider schema（类型仍在上游 schema，仅数据层过滤实例）。

#### Scenario: 默认 LLM provider 实例被移除

- **GIVEN** `[数据层]` `providersConfig` 含 `openai-default` / `deepseek-default` / `atlascloud-default`
- **WHEN** 后台执行同步
- **THEN** 结果不再含这三个实例；`microsoft-translate-default` / `google-translate-default`（普通翻译）保留

#### Scenario: 悬空功能兜底到微软翻译

- **GIVEN** `[数据层]` 某功能（如 `translate`）的 `providerId` 指向一个将被移除的 provider（如 `openai-default` 或过期任译喵实例）
- **WHEN** 后台执行同步
- **THEN** 该功能 `providerId` MUST 被重定向到保留的 `microsoft-translate-default`（免 key），避免 `providerId` 悬空导致 provider 解析抛错

#### Scenario: 保留用户自建的同类 provider

- **GIVEN** `[数据层]` 用户经「添加提供商」新建了一个 OpenAI provider（随机 UUID、非 `openai-default`）
- **WHEN** 后台执行同步
- **THEN** 该用户自建实例 MUST 被保留

### Requirement: 网关地址来源

系统 SHALL 用 fork 独立常量 `RENYIMIAO_GATEWAY_BASE_URL = "https://open-ai.baomiao.cn/v1"` 作为任译喵实例 `baseURL`——它与 `env.WXT_API_URL`（`api.translatebuff.com`，better-auth 后端）不同域，是独立翻译网关，MUST 注释标明"不随环境切换"。MUST NOT 为此改动上游 `src/env`。

#### Scenario: baseURL 取 fork 常量

- **WHEN** 构建任译喵实例
- **THEN** `baseURL` 为 `"https://open-ai.baomiao.cn/v1"`，非从 `env` 派生

### Requirement: key 与模型走上游原流程

系统 SHALL 让任译喵实例的 `apiKey` 配置与模型选择复用上游原流程：`apiKey` 在选项页编辑该 provider 时填写（openai-compatible 通用表单）；"选用某模型" = 在 provider 选择器中选中对应任译喵实例。popup 沿用上游（陪读蛙）完整面板，不额外承载任译喵配置块。会员/登录态为服务端事实，扩展只读、不判权（v1 不实现）。

#### Scenario: popup 沿用上游面板

- **WHEN** 打开 popup
- **THEN** 呈现上游完整面板（账户 / 语言 / provider 选择器 / 翻译模式 + 按钮 / 各开关 / footer），任译喵模型作为选择器条目出现；footer 版本号为 fork `0.0.x`
