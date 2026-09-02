## Context

输入翻译的目标语言支持三种取值：`"sourceCode"`（网页源语言）、`"targetCode"`（翻译目标语言）、固定语言码。解析发生在翻译引擎内部的 `resolveInputLang`（`src/utils/host/translate/translate-variants.ts`），`"sourceCode"` 走 `getFinalSourceCode(config.language.sourceCode, 整页检测码)`。

整页检测码由 `host.content` 一次性快照后缓存在 `session:detectedCode.<tabId>`。在 Discord 这类 SPA 上，该快照取自 `<html lang="en-US">` 与英文 UI 框架，恒为英文，与频道语种无关。

约束：

- `src/types/config/config.ts` 属 fork 的 A 类·绝不改。**不能新增配置枚举值，不能写配置迁移。**
- `translate-variants.ts` 与 `use-input-translation.ts` 属 D 类上游代码，fork 不得原地改。
- 站点规则已有数据层：`getEffectiveSiteRule(config, url)` 返回 `matchedRuleIds`、`includeSelector`、`excludeSelector` 等，`discord` 规则已维护着消息选择器。

## Goals / Non-Goals

**Goals**

- 在声明了聊天上下文的站点上，「网页源语言」跟随最近若干条消息的语种。
- 给用户当场纠错的入口（改语言重译 / 撤销）。
- 不改配置 schema、不写迁移。
- 主路径可作为上游 PR 提交；上游不合并时 fork 侧有可落地的后备。

**Non-Goals**

- 不改「翻译目标语言」`targetCode` 的语义。
- 不改页面翻译、自动翻译、跳过语言所依赖的整页检测链路（`session:detectedCode` 那条时序缺陷是独立问题，不在本次范围）。
- 不做 Discord 之外站点的选择器数据（机制通用，数据只填 Discord）。
- 不引入 LLM 检测；沿用本地 franc。

## Decisions

### D1：语义特化，而非新增枚举值

在声明了聊天上下文的站点上，把 `"sourceCode"` 解释为「当前对话语言」。

否决 `chatContext` 新枚举值：`inputTranslationLangSchema` 在 A 类文件里，改它等于动 fork 红线，且要配迁移脚本；上游合并前 fork 分支会持续越界。语义特化在 fork 与上游是同一份代码。

代价：同一配置项在不同站点含义不同。经 D2 泛化后，语义可表述为「站点声明了对话选择器就用对话语言」，认知负担从"同名不同义"降为"有数据则用数据"。

### D2：站点 → 选择器登记（实施时由「站点规则新字段」改为独立映射表）

> **实施结论**：本节原方案在编码阶段被推翻。`SiteRule` 由 `src/types/config/site-rules.ts` 的
> zod schema 推导，属绝不改区——加字段与 D1 否掉枚举值踩的是同一条红线，且会让 fork 在上游
> 合并前永远带不了这份数据，主备两条路的数据来源就此分叉。最终落成独立映射表
> `src/utils/content/chat-context-sites.ts`：零绝不改区改动，主备共用同一份实现。
> 下面保留原推理，供上游 PR 讨论时参考。

原方案：站点规则新增 `chatContextSelectors` 字段，而非在代码里判 Discord

`resolve.ts` 的选择器字段是清一色的 `mergeSelectorDelta(matched, "<X>Selectors", "<X>Selectors.add", "<X>Selectors.remove")`，追加一项与既有模式同构。

否决 `if (matchedRuleIds.includes("discord"))`：硬编码站点分支不贴合上游既有模式，对上游 PR 不友好，且后续扩展要改代码而非改数据。

范围仍收敛在 Discord —— 机制通用，但只有 `discord` 规则填这个字段。

### D3：语言解析上提到调用层，翻译引擎零改动

解析放在 `use-input-translation.ts`，插在 `enableCycle` 互换之后、调用 `translateTextForInput` 之前。引擎签名与实现不动。

理由：调用层**本来就是**语言决策层（`enableCycle` 的 from/to 互换就在那里）。把解析塞进引擎会让「决定用哪个语言」横跨两层。且 `inputTranslationLangSchema` 本就接受固定语言码，调用层完全可以先解析成具体码再交给引擎。

连带收益：上游 PR 面变小；内联条天然拿到解析结果，无需改引擎返回类型；后备方案的复制面从热点引擎文件降为 fork 自有模块。

### D4：同语言短路提前到调用层

解析出 `resolvedFrom === resolvedTo` 时，在调用 `translateTextForInput` **之前**短路并给出提示。

不依赖引擎内部同名判断：它返回的 `""` 与其他空串返回不可区分，调用层无法据此决定是否提示。提前短路顺带省掉 spinner 与 provider 解析。

### D5：不覆盖用户显式设定的源语言

`getFinalSourceCode(sourceCode, detectedCode)` 在 `sourceCode !== "auto"` 时返回用户钉死的固定码。因此启用条件必须包含 `config.language.sourceCode === "auto"`。用户明确选了源语言就不走上下文检测。

### D6：配置读取走 `getLocalConfig()`

`getEffectiveSiteRule(config, url)` 需要完整 `Config`，且用 `WeakMap` 按对象身份记忆。`configFieldsAtomMap` 是逐字段拆分的 atom，用切片临时拼 `Config` 会让记忆**永不命中**。

若把 `language` 加入 hook 的 atom 依赖，`handleTranslation` 的 `useCallback` deps 必须同步补 `sourceCode` / `targetCode`，否则闭包读到旧值。

### D7：内联条状态带元素归属

状态为 `{ element, originalText, translatedText, resolvedLang, langSource } | null`。

- 撤销前校验 `element` 仍在 DOM 且是当前目标 —— Discord 同时存在主输入框、消息编辑框、搜索框，只存文本会把 A 框原文写进 B 框。
- 现有「翻译期间用户改了输入则放弃替换」的竞态保护**继续用闭包局部变量**；`setState` 是异步的，同一 async 闭包读不到新值。state 只在替换**成功之后**写一次。
- 替换被放弃时**不挂**内联条，否则撤销会把用户新输入改写成一段旧文本。

### D8：交互与定位

- 用 `mousedown` + `preventDefault`：`blur` 会先于 `click` 触发，「失焦即消失」会让条子在点击落地前销毁。
- 定位需跟随滚动、输入框多行长高、窗口缩放；SPA 切频道时销毁。不照抄 `showSpinner` 的一次性 `getBoundingClientRect` —— 那是 `pointer-events: none` 的装饰，不跟随无所谓。

## 数据模型 / 接口契约

### 站点登记

```ts
getChatContextSelector(url: string): string | null   // src/utils/content/chat-context-sites.ts
```

Discord 频道页登记消息选择器 `li[id^=chat-messages] div[id^=message-content]`。**不能用合并后的 `includeSelector`** —— 该规则的 8 条 `includeSelectors` 还含 embed 标题、频道 header、搜索结果、popout。

### 检测函数

```ts
detectChatContextLanguage(
  doc: Document,
  selectors: { chatSelector: string | null; excludeSelector: string | null },
  limit = 5,
): Promise<LangCodeISO6393 | null>
```

取 `chatSelector` 命中节点的末尾 `limit` 条；每条先克隆、再删除 `excludeSelector` 命中的子孙节点、再取 `textContent` 并抹掉 URL。

判定不是把这几条拼起来一次算——franc 按长度加权，聊天室里最长的往往是机器人的英文公告，会把周围几条短的人类消息整个压过去（人工验收就栽在这里）。实际做法：最新一条含假名或谚文就直接定日／韩（这两套字形各自只有一种语言在用，且 franc 拒判 10 字符以下）；否则只把窗口内**与最新一条同文字系统**的消息合起来喂 franc。西里尔与汉字不按字形猜——俄塞乌共用、中日共用，实测短俄语会被判成塞尔维亚语。

### 解析函数（必须是可复用导出，见 R3）

```ts
resolveInputTranslationLang(
  lang: InputTranslationLang,
  config: Config,
  url: string,
  doc: Document,
): Promise<{ code: LangCodeISO6393; source: "chatContext" | "pageSource" | "explicit" }>
```

- `"targetCode"` → `{ config.language.targetCode, "explicit" }`
- `"sourceCode"`：
  - `config.language.sourceCode !== "auto"` → `{ 该固定码, "explicit" }`（D5）
  - 否则站点已登记选择器时试 `detectChatContextLanguage`，命中 → `{ code, "chatContext" }`
  - 否则 → `{ getFinalSourceCode("auto", 整页检测码), "pageSource" }`
- 固定语言码 → `{ 原值, "explicit" }`

`source` 供内联条区分「自动检测」与「按网页源语言」；手动改语言后由界面层置为 `manual`（显示「手动选择」）。`explicit` 表示语言由配置直接给定，此时**不挂内联条**——没有自动判定，也就没有要纠错的对象。

## Risks / Trade-offs

### R1：@提及与频道链接无法从检测样本剔除（已知限制）

Discord 两条规则的排除项是 username / timestamp / repliedMessage / container，**没有一条匹配 `<span class="mention_xxx">`**；`cleanText` 也只去零宽字符、压空白、截断。提及与频道链接是拉丁字符，会把 franc 轻微拽向英语——而"被拽向英语"正是本需求要修的病。

缓解：时间戳、用户名、回复预览确实能剔除，仍值得清洗；内联条的手动改语言是这个残余偏差的兜底。产品侧已接受。

测试相应写成「含提及的俄语消息仍被判为俄语」，而不是断言"提及被清掉"。

### R2：上游可能不合并

主路径是向 read-frog 提 PR，**拆两个**：

- **PR#1**：站点登记 + `detectChatContextLanguage` + 调用层解析（含 D5）
- **PR#2**：内联条 UI，含同语言提示条形态

拆分理由：引擎能力与 Discord 专属 UI 的上游接受度差很多；拆开则前者更可能被收，且即使只收 PR#1，静默路径也已堵上。

后备（上游不合并）：`src/entrypoints/selection.content/app.tsx` 已是两行 shim，`src/fork/ui/selection-content/App.tsx` 已经在直接调 `useInputTranslation()` —— **fork 早就 own 了这个调用点**。后备只需在该 C 类文件里换成 fork 版 hook：无重定向条目、无指纹基线、无 allowlist 改动、无越界。

代价：重定向的 sha256 护栏会在上游改动时**硬失败构建**逼人对账，fork 自持调用点则是**静默漂移**。缓解：补一个把上游 hook 内容 sha256 钉死的小测试，用最低成本换回该告警。

### R3：部分合并的结局

最可能的结局是「PR#1 合了、PR#2 没合」。此时后备只剩内联条，且内联条可以是纯 fork 增量——**前提是 PR#1 必须把 `resolveInputTranslationLang` 的 `{ code, source }` 结果暴露成可复用导出**，而不是埋在 hook 内部。这是对 PR#1 的硬设计约束，现在不写死，将来就只能整份复制。

### R4：缓存分片变细

`extraHashTags` 由 `inputTranslation:sourceCode->targetCode` 变为解析后的具体语种对（如 `inputTranslation:rus->cmn`）。旧条目失效、分片变细，但**不会脏命中**——哈希本就包含解析后的源/目标语种。属可接受的一次性成本。

### R5：`getEffectiveSiteRule` 记忆失效

见 D6。误用 atom 切片拼 `Config` 会让 WeakMap 每次落空，在每次触发翻译时重解析全部站点规则。缓解手段就是 D6 本身，并在实施时确认调用点走 `getLocalConfig()`。

## Open Questions

无。探索阶段的四项产品决策与两轮架构审查的全部问题均已收敛。
