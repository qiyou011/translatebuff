## Why

任译喵的「词典」（选中单词看词条 / 音标 / 词性 / 释义 / 例句 / 难度等结构化释义）目前在悬浮工具栏里被一个设置齿轮顶替、点不出词典。根因：词典依赖模型的结构化输出，上游对内置翻译实例强制发送 `response_format: json_schema` 强约束参数，而任译喵网关模型不认该参数、直接报错，当初只能用齿轮临时挡住入口。

产品上，词典是划词学习的核心能力之一；测试同学也需要能在工具栏点到词典完成验收。本次让词典在任译喵网关上真正可用，并把入口还给用户。

## What Changes

- **词典结构化输出降级**：任译喵内置翻译在执行词典这类结构化动作时，改用网关支持的 JSON 模式（`json_object`）替代 `json_schema`，使词典在任译喵模型上正常返回结构化结果。降级只作用于结构化动作执行路径，**普通翻译（整页 / 划词 / 语言检测 / 摘要 / 分段）不受影响**。
- **悬浮工具栏词典入口回归**：移除临时顶替词典的设置齿轮，词典按钮回到工具栏，点击直接执行词典动作。
- **【非破坏性】**：不改词典模板、不改输出字段结构、不改系统提示词、不碰任何上游引擎与配置 schema。

## Capabilities

### New Capabilities

- `fork-dictionary-restore`: 任译喵词典恢复可用——含结构化动作在网关上的 `response_format` 降级（API 层），与悬浮工具栏词典入口回归、齿轮移除（UI 层）。

### Modified Capabilities

<!-- 无。齿轮 redesign 本就不在 fork-selection-toolbar-shell 的 spec 内，撤除属回归到既有规格描述，无需改动其 spec。 -->

## Impact

- **影响路径**：仅任译喵内置翻译的「结构化动作执行链」（当前唯一实例 = 词典）+ 悬浮工具栏渲染。普通翻译各路径零影响。
- **软 fork 边界**：全部落在 `src/fork/**`（C 类净新增 / 改动），零 allowlist，不碰上游 `model.ts` / `background-stream.ts` / config schema。
- **外部依赖**：依赖 `@ai-sdk/openai-compatible` 的 `providerOptions` 穿透行为——需锁版本，并以「词典出站请求体 `response_format` 为 `json_object`」的集成断言兜住其内部实现脆弱性。
- **测试参考（一模块一行）**：
  - 结构化降级：注入正确性 · 合入 recommended（保留 `thinking:disabled`）· 不可变性（不污染共享 provider config）· 非任译喵 provider 豁免 · 出站请求体 `response_format=json_object`
  - 工具栏入口：词典走正常触发器（非齿轮）· 齿轮引用清零 · 壳源级不变量仍绿
