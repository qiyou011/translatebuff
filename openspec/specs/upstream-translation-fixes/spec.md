# upstream-translation-fixes Specification

## Purpose

TBD：本规格由 v1-4-1-upstream-translation-improvements 归档创建，后续完善能力目的说明。

## Requirements

### Requirement: 站点正文与播放器边界

系统 SHALL 修复 Alibaba RFQ Details 正文漏译和 arXiv 标题译文重叠，并 MUST 排除 Substack 整个视频播放器，同时保留页面正文翻译。

#### Scenario: Alibaba 和 arXiv 页面翻译

- **WHEN** 翻译包含 RFQ Details 正文或 arXiv 标题的页面
- **THEN** 正文被提取并翻译，标题译文不因行高而重叠，恢复原文后页面仍可使用

#### Scenario: Substack 视频页面

- **WHEN** 对含视频播放器的 Substack 文章执行页面翻译
- **THEN** 播放器子树不被翻译或插入译文，播放器外正文照常翻译

### Requirement: 实际交互入口适配

系统 SHALL 在实际加载的 fork 划词、悬浮控件及 popup 中应用交互修复，MUST 保留现有服务提供商权限规则。

#### Scenario: 空闲覆盖层与折叠悬浮控件

- **WHEN** 用户在空闲划词覆盖层或折叠悬浮控件周围拖动轮播、点击页面
- **THEN** 非交互区域不截获事件，控件自身按钮仍可点击，划词翻译与自定义动作仍可触发

#### Scenario: 仅译文不可用

- **WHEN** 当前配置不允许仅译文模式
- **THEN** 实际 popup 与共享选择器展示一致的禁用原因，合法配置仍可切换模式

### Requirement: 自动保存与组合输入

系统 SHALL 在组合输入期间保留草稿，在结束输入及导航时按控制器规则保存有效值，并 MUST 防止不同配置字段的并发保存互相覆盖。

#### Scenario: IME 与并发更新

- **WHEN** 用户进行中文组合输入且另一字段或配置消费者同时更新
- **THEN** 中间组合文本不会提前提交，最终有效值被保存，独立字段更新均保留

#### Scenario: 无效 JSON 与导航

- **WHEN** 用户输入无效 JSON 后导航或修正输入
- **THEN** 无效草稿不得覆盖持久有效配置，控制器按导航策略保留或阻止丢失草稿，修正后可保存

#### Scenario: fork 设置页

- **WHEN** 用户打开 fork 提供商设置和可编辑自定义动作
- **THEN** 提供商密钥、BaseURL 和模型继续只读，自定义动作通过实际配置路径正确保存

### Requirement: 公式占位符与双层缓存

系统 SHALL 将行内公式作为可恢复的原子节点处理，向实际页面批处理提示词传递 token 保留要求，并 MUST 在后台持久缓存和标签页内存缓存中使用相同的 token 完整性准入规则。

#### Scenario: 正常与异常 token 响应

- **WHEN** 模型返回包含全部正确 token、缺失 token、重复 token 或凭空新增 token 的译文
- **THEN** 正确响应可缓存并恢复公式；后三类响应不得写入任一缓存；渲染恢复逻辑可补回缺失公式且不引入不安全节点

#### Scenario: 无需翻译响应与不同队列

- **WHEN** 原文含公式但返回合法无需翻译 sentinel，或通过结构化 JSON 批处理、旧版及单条路径翻译
- **THEN** sentinel 可按无需翻译语义处理，所有执行路径均遵守双层缓存准入及公式恢复契约

### Requirement: 字幕缓存与控制条

系统 SHALL 清理超过七天的 AI 分句缓存并同步注册清理 alarm，SHALL 正确测量 YouTube 控制条且 MUST 不因此开放 AI 转录入口。

#### Scenario: 分句缓存到期

- **WHEN** 后台清理任务执行
- **THEN** 超过七天的缓存被清理，未到期及边界时间数据遵循明确测试的保留规则，后续可重新生成缓存

#### Scenario: YouTube 播放器切换

- **WHEN** 用户在标准、嵌入或迷你播放器中显示和隐藏控制条
- **THEN** 字幕按实际控制条高度避让，不把游离进度条当作控制条高度，不引入直播回放 AI 转录逻辑

### Requirement: 保留名称与分句提示词

系统 SHALL 区分可保留名称、代码和需要翻译的外语正文，SHALL 在 AI 分句中优先约束长度而非句意完整性或静音位置，并保留短 cue 例外。

#### Scenario: 保留名称判断

- **WHEN** 输入只有应保留名称或代码，或输入包含需要翻译的外语正文
- **THEN** 提示词明确前者可返回 sentinel、后者需要翻译，实际 fork 批处理保留同一约束

#### Scenario: 分句长度冲突

- **WHEN** 句意完整性、静音边界与分句长度限制冲突
- **THEN** 提示词明确长度优先并描述短 cue 例外；单测验证提示词契约，真实模型质量另行记录

### Requirement: 选择范围和回归证据

本期 MUST 实施 upstream-fixes.md 中 12 条选定修复，保留 3 条延期及原因，SHALL 分别记录自动测试和真实浏览器、真实模型证据。

#### Scenario: 完成验收

- **WHEN** 标记本期实施完成
- **THEN** 12 条均有实际 fork 路径证据，延期项未被意外引入，外部翻译服务测试按 SKIP_FREE_API=true 明确跳过，未执行的真实验证不得标记通过
