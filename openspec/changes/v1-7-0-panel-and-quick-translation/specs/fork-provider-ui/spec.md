## MODIFIED Requirements

### Requirement: fork 选择器只呈现任译喵与普通翻译

系统 SHALL 使用 fork 选择器展示“普通翻译”和“TranslateBuff 提供的模型”分组，普通翻译包含 Google Translate 与 Microsoft Translator，托管模型平铺且每功能独立选择；继续隐藏未批准的上游免费 AI 及其他原先隐藏的 UI 项，不删除用户底层配置。国内仅展示国内模型，海外展示全部；原型国内 8 个、海外 13 个为目录对齐基准，实际目录、顺序、倍率与可用性 MUST 从正式服务配置核对，不伪造可用模型或计费倍率。

#### Scenario: 只出两组、任译喵组平铺多模型

- **WHEN** 目录含托管实例、普通翻译、其他 LLM 及免费 AI
- **THEN** 只显示批准的两组，托管实例平铺模型名、显示层去冗余品牌前缀；过滤空组并保持共享选择器 props 兼容

#### Scenario: 分版模型范围

- **WHEN** 国内或海外版渲染面板及完整设置提供商选择
- **THEN** 两处使用同一目录与能力过滤，国内不暴露海外限定模型，海外包含两类；与原型目录不一致时记录差异，不填假模型凑数

#### Scenario: 每功能各选不同模型

- **WHEN** 网页与划词选择不同提供商
- **THEN** 各自已有 providerId 字段分别更新，实际翻译走对应实例

#### Scenario: 空态兜底不崩

- **WHEN** 目录为空或已保存模型不再可用
- **THEN** 显示不可用原因及可选替代，不崩溃、不伪造成功、不静默改成收费模型；无选项时禁用选择

### Requirement: fork popup provider 块

系统 SHALL 在网页首页及各功能快捷设置中呈现该功能提供商，复用现有功能 provider 字段和补丁逻辑。原有自定义动作配置保持可从完整设置访问，不能因替换 summary/Drawer 入口丢失数据。

#### Scenario: popup 采用 fork provider 块

- **WHEN** 构建后打开 popup 的网页首页或功能快捷设置
- **THEN** 使用 fork 提供商选择器及批准分组，入口由快捷设置替代旧 summary/Drawer，不改变既有自定义动作配置

#### Scenario: 快捷选择直接生效

- **WHEN** 用户在输入快捷设置选择提供商
- **THEN** 完整设置同步显示该值，之后输入请求使用该值，其他功能和自定义动作不改变

## ADDED Requirements

### Requirement: 默认提供商与已有选择

系统 SHALL 在没有已保存选择时按发行版采用国内 Microsoft、海外 Google；遵循原型要求保留已有选择，不按账号身份划分功能。

#### Scenario: 默认与保留

- **WHEN** 创建缺失配置或升级已有配置
- **THEN** 缺失值使用对应默认，已有有效 providerId 保留；所有用户可用功能及触发规则相同
