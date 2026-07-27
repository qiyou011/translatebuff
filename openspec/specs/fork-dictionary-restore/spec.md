# fork-dictionary-restore Specification

## Purpose

TBD - created by archiving change fork-dictionary-restore. Update Purpose after archive.

## Requirements

### Requirement: 任译喵词典结构化输出降级 [API层]

任译喵内置翻译实例（`openai-compatible`、id 以 `renyimiao-` 前缀）执行词典这类结构化自定义动作时，系统 MUST 将出站请求的 `response_format` 从 `json_schema` 降级为 `json_object`，以适配不支持 `json_schema` 强约束的网关模型；且 MUST 保留该模型的 recommended provider 选项。降级 MUST 通过一次性瞬时 provider 引用实现，MUST NOT 写回或原地修改共享的 providers 配置。降级 MUST 只作用于结构化动作执行链，MUST NOT 影响普通翻译路径。

#### Scenario: 任译喵实例执行词典时降级为 json_object

- **GIVEN** 一个任译喵 `openai-compatible` 实例（id 以 `renyimiao-` 开头）绑定默认词典动作
- **WHEN** 用户触发词典、执行到构建结构化请求
- **THEN** 传入执行计划的 provider 引用，其 `config.providerOptions` 内层 MUST 含 `response_format: { type: "json_object" }`
- **AND** 最终出站请求体的 `response_format.type` MUST 为 `"json_object"`，MUST NOT 为 `"json_schema"`

#### Scenario: 保留模型 recommended 选项

- **GIVEN** 任译喵实例对应模型 `Deepseek-V4-Flash` 的 recommended 选项为 `{ thinking: { type: "disabled" } }`
- **WHEN** 降级注入 `response_format`
- **THEN** 合并后的 `providerOptions` MUST 同时保留 `thinking: { type: "disabled" }`
- **AND** recommended 选项 MUST 由 `resolveModelId` + `getRecommendedProviderOptions` 泛化推导，MUST NOT 硬编码某一模型

#### Scenario: 不可变——不污染共享 provider 配置

- **GIVEN** provider 引用的 `config` 与 providers 配置数组里对应实例是同一对象引用
- **WHEN** helper 注入 `response_format`
- **THEN** helper MUST 返回新的 ref 与新的 `config` 对象（浅拷贝），MUST NOT 原地变异 `ref.config`
- **AND** 注入后，原 providers 配置中该实例的 `providerOptions` MUST 保持不变（注入前为 `undefined` 则仍为 `undefined`）

#### Scenario: 非任译喵 provider 一律豁免

- **WHEN** provider 引用不同时满足「`kind === "local"`」与「是任译喵实例（`isRenyimiaoInstance`）」——涵盖内置免费 AI（`kind === "system"`）、纯翻译 provider（google / microsoft）、用户自带 LLM 实例（id 无 `renyimiao-` 前缀）
- **THEN** helper MUST 原样返回该引用
- **AND** MUST NOT 注入 `response_format`

#### Scenario: 普通翻译请求不带 response_format

- **GIVEN** 整页 / 划词 / 语言检测 / 摘要 / 分段翻译走独立文本生成路径，不经词典执行链
- **WHEN** 执行任一普通翻译
- **THEN** 其出站请求体 MUST NOT 因本能力而带上 `response_format` 字段

### Requirement: 悬浮工具栏词典入口回归 [UI层]

悬浮工具栏对默认词典动作 MUST 直接渲染可执行的自定义动作触发按钮，MUST NOT 再以设置齿轮顶替。临时齿轮组件及其所有引用 MUST 移除，且移除后 fork 翻译浮窗壳的既有源级不变量 MUST 仍然成立。

#### Scenario: 词典走正常触发器而非齿轮

- **GIVEN** 默认词典动作（id = `default-dictionary`）已启用
- **WHEN** 渲染悬浮工具栏
- **THEN** 词典 MUST 渲染为标准自定义动作触发按钮（与其它自定义动作同型）
- **AND** MUST NOT 渲染设置齿轮

#### Scenario: 齿轮引用清零

- **WHEN** 检索 fork 翻译浮窗壳（`src/fork/ui/selection-content/`）源码
- **THEN** MUST 不存在对齿轮组件（`SettingsButton` / `SelectionToolbarSettingsButton`）的任何 import 或使用
- **AND** 齿轮组件文件 `SettingsButton.tsx` MUST 被删除

#### Scenario: fork 壳源级不变量仍满足

- **WHEN** 运行 fork 翻译浮窗壳源级不变量测试
- **THEN** 「彻底省略 notebase / 猜你想存」不变量 MUST 仍然通过
- **AND** 「D4 三元组绑定（消费者读 fork context、不 import 上游 provider）」不变量 MUST 仍然通过
