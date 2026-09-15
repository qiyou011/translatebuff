## ADDED Requirements

### Requirement: 页面与交互调度隔离

系统 SHALL 将页面 LLM 和免费 MT 分别聚合并共享页面在途上限；输入不等待页面队列，划词独立流式及字幕路径不变。

#### Scenario: 页面饱和时交互到来

- **WHEN** 页面实际在途达到候选4且输入翻译到来
- **THEN** 输入可独立发起，页面不得超过上限，字幕不受该上限影响

#### Scenario: 超时请求迟结束

- **WHEN** 请求超时或取消但底层thunk尚未settle
- **THEN** 系统继续占用该实际并发额度直到settle，重试也必须受限

### Requirement: 默认提示压缩与兼容

系统 SHALL 仅对默认提示使用flat JSON和紧凑原生标签；其他内置和自定义模板保持原提示及协议。所有provider和prompt参数在入批时冻结。

#### Scenario: 使用自定义提示

- **WHEN** 用户选择自定义模板后提交页面翻译
- **THEN** 系统保持该模板与原%%协议，不强制改写为JSON；仍受页面上限约束

#### Scenario: 配置中途改变

- **WHEN** 页面请求已入批但用户修改模型或提示
- **THEN** 已入批请求使用原快照，新配置不与旧配置合批

### Requirement: 可还原标记与逐项失败

系统 SHALL 在wire层压缩真实HTML属性，避免修改正文/注释/raw-text，并在缓存或回填前恢复原协议和校验。sentinel必须保留。协议错误不得触发网络层整批重试；仅未通过项一次单条降级。

#### Scenario: 部分字段损坏

- **WHEN** 正确JSON包含有效t0而t1缺失或非字符串
- **THEN** t0不重发，仅t1降级一次；再失败只拒绝t1，失败不缓存

#### Scenario: 标记丢失或移动到错误标签

- **WHEN** 返回缺少标记、重复标记、未知标记或标记tag改变
- **THEN** 该项校验失败，不缓存和回填；仍保留其他通过项

#### Scenario: 无需翻译

- **WHEN** 返回合法sentinel
- **THEN** 系统保留sentinel交给既有content逻辑，不渲染标记也不误触发重试

### Requirement: MT编解码与载荷边界

系统 SHALL 按完整格式/换行/语言/provider快照分组Google和Microsoft，候选100条和编码后32KiB边界同时约束。MS禁止HTML；Google保持语义换行；原单条契约及解码一次不变。

#### Scenario: 混合格式输入

- **WHEN** 同引擎同时收到plain、html以及preserveLineBreaks不同的项
- **THEN** 不同语义项不得合批；Microsoft html沿用明确拒绝

#### Scenario: 部分MT结果缺失

- **WHEN** 响应数量正确但某位置没有有效文本
- **THEN** 仅该项失败；数量不一致无法对齐时整体协议失败，不猜测位置

### Requirement: scope取消隔离

系统 SHALL 在批次、去重与下游请求hash中纳入scope，不跨scope合并在途任务；降级及cache write前必须重新检查存活。

#### Scenario: 两个标签相同文本

- **WHEN** 两标签提交相同文本且其中一个取消
- **THEN** 另一标签继续完成；取消标签不得触发降级或写缓存，持久缓存仍可共享

### Requirement: v1.4.0默认对迁移

系统 SHALL 仅在新包初始化后迁移精确旧4/1000默认对至实测选定候选，保留其他自定义组合及字幕。迁移采用独立标记及共享初始化Promise。

#### Scenario: 自定义组合与失败恢复

- **WHEN** 存量组合为4/2000或迁移写入失败
- **THEN** 前者不变；后者不得记录成功标记，下次初始化允许重试

### Requirement: 实测发布门

系统 MUST 对固定真实引擎快照和模型/浏览器矩阵给出可复现实测，不将候选数值或单测当已达标效果。

#### Scenario: 只有自动化协议测试

- **WHEN** 单测通过但缺真实模型或浏览器性能结果
- **THEN** 对应发布验收保持未完成，不宣称节省≥50%、卡顿解决或最终默认已冻结
