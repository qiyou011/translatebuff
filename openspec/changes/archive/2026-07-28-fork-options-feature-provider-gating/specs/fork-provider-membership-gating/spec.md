# fork-provider-membership-gating

未登录（或登录但网关 key 尚未注入）时，任译喵网关模型无可用凭据、点它翻译必然失败。本能力规定：在功能提供商选择面（popup 与选项页「通用」页），当任译喵不可用时对其进行 UI 层门禁——隐藏不可用项、无其它可选时改显登录引导、并保证门禁前置的实例已就位；跨面行为一致。门禁只发生在展示层，不触碰 seed / repoint 配置，也不构成安全边界（会员态仍由服务端裁决）。

「可用性」的唯一判据：任译喵共享 key 为空字符串（`renyimiaoApiKey(providersConfig) === ""`）即视为不可用，覆盖「未登录」与「已登录但 key 尚未注入」两种情形。

## ADDED Requirements

### Requirement: 无可用 key 时隐藏任译喵项

任译喵不可用（共享 key 为空串）时，功能提供商选择面 MUST 从可选 provider 列表中过滤掉全部任译喵实例；可用（key 非空）时 MUST NOT 过滤。过滤是纯展示层行为，MUST NOT 改动 `providersConfig` 中的任译喵实例本身（repoint 靶子保留）。

#### Scenario: 未登录时任译喵被隐藏

- **GIVEN** `[UI层]` 用户处于登出态，任译喵共享 key 为 `""`
- **WHEN** 打开某功能行的 provider 下拉
- **THEN** 下拉候选中 MUST NOT 出现任何任译喵实例
- **AND** 用户自行配置的非任译喵 provider（如 Microsoft / Google / 自有 OpenAI）MUST 照常出现

#### Scenario: 有可用 key 时任译喵正常展示

- **GIVEN** `[UI层]` 用户已登录且网关 key 已注入（key 非空）
- **WHEN** 打开某功能行的 provider 下拉
- **THEN** 任译喵实例 MUST 照常作为候选出现、可选中

### Requirement: 无其它可选或选中即任译喵时改显登录引导

当任译喵不可用，且某功能行满足以下任一条件时，该行 MUST 用登录引导替换选择器，而非渲染空/孤儿下拉：过滤后可选列表为空（该功能仅任译喵可用）；或该功能当前选中的正是被隐藏的任译喵实例。二者皆不满足时 MUST 正常渲染过滤后的选择器。

#### Scenario: 过滤后无可选项改显登录引导

- **GIVEN** `[UI层]` 任译喵不可用，某 LLM-only 功能（如词典 / 自定义 AI 指令）过滤任译喵后可选列表长度为 0
- **WHEN** 渲染该功能行
- **THEN** 该行 MUST 显示登录引导、MUST NOT 渲染空下拉

#### Scenario: 当前选中即被隐藏的任译喵时改显登录引导

- **GIVEN** `[UI层]` 任译喵不可用，某功能当前选中的 provider id 为任译喵实例（即便该功能另有非任译喵可选）
- **WHEN** 渲染该功能行
- **THEN** 该行 MUST 显示登录引导，MUST NOT 把"选中值不在过滤后列表"的孤儿 value 传入选择器

### Requirement: 门禁选择器对孤儿选中值不得崩溃

fork provider 选择器 MUST 在「当前选中值不存在于候选列表」时安全降级为占位（placeholder），MUST NOT 因对空选中值取显示信息而抛错。此为独立于宿主判定的兜底防线。

#### Scenario: 选中值不在列表时降级为占位

- **GIVEN** `[UI层]` 传入选择器的选中 id 不匹配任何候选 provider
- **WHEN** 渲染选择器触发条
- **THEN** 触发条 MUST 显示 placeholder，MUST NOT 抛出运行时错误

### Requirement: 登录引导按会员态三态展示

登录引导 MUST 按会员态区分：未登录时 MUST 提供登录入口按钮；已登录但 key 尚未注入（补偿窗口）时 MUST 显示「获取中」占位、MUST NOT 对已登录用户再显示登录按钮。

#### Scenario: 未登录显登录按钮

- **GIVEN** `[UI层]` 用户登出态（无会话）
- **WHEN** 某功能行触发登录引导
- **THEN** MUST 显示可点击的登录入口

#### Scenario: 已登录待取 key 显获取中

- **GIVEN** `[UI层]` 用户已登录、会话存在，但任译喵 key 仍为空（挂载补偿窗口内）
- **WHEN** 某功能行触发登录引导
- **THEN** MUST 显示「获取中」占位、MUST NOT 显示登录按钮

### Requirement: 非任译喵 provider 的缺 key 提示保持上游行为

门禁仅针对任译喵。选项页「通用」页中，非任译喵 provider 在缺 key 时 MUST 保持上游既有的缺 key 警告（标签旁提示），MUST NOT 被本门禁替换或改文案。

#### Scenario: 自有 provider 缺 key 仍走上游警告

- **GIVEN** `[UI层]` 选项页「通用」页，某功能选中的是用户自有的非任译喵 provider 且未配 key
- **WHEN** 渲染该功能行
- **THEN** MUST 显示上游的缺 key 警告、MUST NOT 显示任译喵登录引导

### Requirement: 门禁面挂载时确保任译喵实例就位

承载门禁的功能提供商面 MUST 在挂载时确保任译喵实例已 seed/repoint 就位，与其它已 seed 的面（popup、选项页「API 提供商」页）对齐，避免首装直开该面时门禁前置缺失。

#### Scenario: 首装直开选项页通用页

- **GIVEN** `[UI层]` 首次安装、用户未开过 popup、直接打开选项页并停在「通用」标签
- **WHEN** 「通用」页功能提供商面挂载
- **THEN** 任译喵实例 MUST 已就位，门禁 MUST 按可用性正确触发

### Requirement: 跨面门禁行为一致

popup 与选项页「通用」页的任译喵门禁 MUST 由同一份判定逻辑驱动（过滤 + 是否改显引导），确保两面行为一致、单点维护。

#### Scenario: 两面对同一配置得到一致门禁结果

- **GIVEN** `[UI层]` 同一 `providersConfig`（同一可用性状态）
- **WHEN** 分别在 popup 与选项页「通用」页渲染同一功能行
- **THEN** 两面 MUST 得到一致的门禁结果（同样过滤任译喵、同样是否改显引导）
