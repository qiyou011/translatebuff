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
- 内联条、同语言提示及语言菜单与宿主输入区域的深浅色主题协调，文字清晰，主题变化不干扰翻译会话。
- 不改配置 schema、不写迁移。
- 主路径可作为上游 PR 提交；上游不合并时 fork 侧有可落地的后备。

**Non-Goals**

- 不改「翻译目标语言」`targetCode` 的语义。
- 不改页面翻译、自动翻译、跳过语言所依赖的整页检测链路（`session:detectedCode` 那条时序缺陷是独立问题，不在本次范围）。
- 不做 Discord 之外站点的选择器数据（机制通用，数据只填 Discord）。
- 不引入 LLM 检测；沿用本地 franc。
- 不改用户的全局主题偏好，不为主题适配新增配置项，不联动改变划词浮窗与设置页。

## Decisions

### D12：fork 自持边界（2026-09-05 用户确认，覆盖下文历史主备交付选择）

为支持不定期合并上游，本次启用原 R2 的 fork 自持路径，不等待上游是否接受 PR。业务模块、主题、内联条及测试集中在 `src/fork/ui/selection-content/input-translation/`。fork App 只调用该目录导出的 hook，不同时挂载上游 hook，不增加全局重定向。

恢复上游 `use-input-translation.ts`、`index.ts`、`language-combobox.tsx` 与 `ui/base-ui/combobox.tsx` 到已同步基线。专用 `InputTranslationLanguageSelect` 仅组合所需的 Base UI Portal/Positioner/Popup，复用上游语言列表、过滤与 Input/Item/List；不复制整套共享组件。D9–D11 的主题、尺寸与焦点规则不变，D10 的共享组件扩展方式由此替代。

引擎、配置读取、provider、输入替换协议与注入脚本继续复用上游，不改 schema/迁移。九语文案保留现有 allowlist 内的独立新增块，文案加载器不变。

新增四文件 SHA-256 漂移哨兵，以 `02ad422c` 为人工已评审基线；上游变化必须先对账并移植适用修复、验证 fork 行为，再更新指纹，禁止自动刷新。恢复源文件消除文本冲突，不代表上游行为会自动进入 fork 副本。

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

会话状态为 `{ element, originalText, translatedText, resolvedLang, langSource } | null`，显示状态与会话状态分离。失焦可将显示状态切为隐藏，但不得因此清空会话状态。

- 撤销前校验 `element` 仍在 DOM 且是当前目标 —— Discord 同时存在主输入框、消息编辑框、搜索框，只存文本会把 A 框原文写进 B 框。
- 现有「翻译期间用户改了输入则放弃替换」的竞态保护**继续用闭包局部变量**；`setState` 是异步的，同一 async 闭包读不到新值。state 只在替换**成功之后**写一次。
- 替换被放弃时**不挂**内联条，否则撤销会把用户新输入改写成一段旧文本。
- `originalText` 是三空格触发时截取的**不可变原文快照**。替换成功后，用户可以继续删除、修改或新增译文内容；这些后续编辑不得覆盖 `originalText`，内联条也不得仅因内容变化而消失。用户点击撤销时始终把该快照写回原输入元素，而不是回到任何编辑后的译文状态。
- 必须区分两个时间窗：翻译请求完成前发生编辑，属于竞态保护，放弃替换且不挂条；翻译成功后发生编辑，属于用户对译文的正常修改，保留撤销到初始原文的能力。焦点真正离开输入框及内联条交互范围时仅隐藏；重新聚焦状态中记录的同一 `element` 时恢复。消息实际发送、按 Esc、点击撤销或元素卸载才结束本次内联条会话并清空快照。

### D8：交互与定位

- 用 `mousedown` + `preventDefault`：`blur` 会先于 `click` 触发，「失焦即消失」会让条子在点击落地前销毁。
- 定位需跟随滚动、输入框多行长高、窗口缩放；SPA 切频道时销毁。不照抄 `showSpinner` 的一次性 `getBoundingClientRect` —— 那是 `pointer-events: none` 的装饰，不跟随无所谓。
- “失焦”按整个交互范围判断：焦点从输入框移到内联条、语言选择器或其弹出菜单不算离开；只有焦点落到该范围之外才暂时隐藏。Portal 到 shadow root 的语言菜单也必须纳入范围，不能因 DOM 层级分离误隐藏。隐藏期间继续保留元素归属和不可变原文快照，只有原输入元素重新获得焦点时才恢复，其他输入框不得借用该状态。
- “消息发送”指消息已经实际提交，不得把任意 `Enter` 都当成发送；`Shift+Enter` 等换行操作必须保留内联条。
- `Esc` 采用分层关闭：语言菜单展开时第一次 Esc 只关闭菜单并保留内联条；菜单关闭后再按 Esc 才关闭内联条。
- 同语言提示没有撤销对象，属于一次性反馈；继续输入、消息实际发送、按 Esc 或焦点真正离开输入框后即可关闭。

### D9：输入区域主题适配（2026-09-05 确认，已实施，待实页验收）

主题解析属于输入翻译 UI 层，在 `src/entrypoints/selection.content/input-translation/` 新增专用模块，由 `InputTranslationBar` 消费；不放入语言解析或翻译引擎。

判定顺序：

1. Discord 使用真实页面确认过的主题标记，将浅色与各深色变体归一为 `light` / `dark`。实施前记录标记及其所在元素，不猜测或依赖构建生成的类名后缀；标记缺失或无法识别时进入背景判断。
2. 其他页面读取输入元素及祖先的计算背景色。透明背景向上查找，半透明纯色背景结合祖先颜色求有效颜色，再按相对亮度分类。检测仅面向输入区域，不扫描消息内容。
3. 背景包含图片、渐变，或无法可靠求得有效颜色时，回退扩展当前解析后的深浅主题。控件自身使用不透明底色，使回退仍具有稳定的文字对比度。

主题结果仅保存在组件局部；不得写主题 atom 或 storage。解析过程不读取或发送用户草稿。监听当前主题标记及选定祖先的相关属性，合并同一帧内的重复更新；禁止为主题检测全量监听 `document.body` 的消息子树或持续轮询。首次显示、重新聚焦恢复、菜单打开时重新校验；监听的输入元素替换或卸载时清理并重新绑定。

### D10：专属主题作用域与 Portal

在已有 selection Shadow Root 内建立输入翻译专属主题作用域，并为语言菜单提供同主题的专属 Portal 容器。条体与菜单可以为兄弟节点，但必须消费同一个解析结果及配色变量；不得修改整个 `shadowWrapper` 的主题，也不得将菜单移到无扩展样式的页面 `document.body`。

主题变化通过更新局部 class / CSS 变量实现，不以 theme 作为 React key，不重挂翻译 hook、菜单或会话。菜单已打开时原位更新颜色，保持焦点、搜索文本、选中项和不可变 `originalText`。专属 Portal 容器仍属于 D8 的交互范围，保留分层 Esc 与失焦恢复语义；容器不得产生新的裁剪或错误层叠上下文。

共享 `LanguageCombobox` 只按需透传可选的菜单宽度、展开方向等参数，默认值兼容现有调用。新增作用域与监听随输入翻译 UI 生命周期释放，不遗留空容器或脱离文档的元素引用。

### D11：配色、菜单尺寸与可读性

保留现有贴合输入框的位置、紧凑高度、圆角与纯文字操作。条体使用稳定的不透明底色，避免透明混合造成深底黑字；同语言提示复用同一配色。

| 元素                     | 深色起始值 | 浅色起始值 |
| ------------------------ | ---------- | ---------- |
| 内联条、菜单背景         | `#29292D`  | `#F7F7F8`  |
| 语言名称、菜单正文、撤销 | `#F2F3F5`  | `#202127`  |
| 来源说明、箭头           | `#B5BAC1`  | `#606570`  |

以上为实现起点，最终颜色以真实渲染结果为准。普通文字（含说明、搜索占位和撤销）与实际背景对比度至少 4.5:1；撤销悬停加下划线，键盘聚焦有清晰轮廓，菜单 hover / selected / focus 状态均须可辨识。不得把可操作的撤销画成禁用态。

菜单向上展开，上方空间不足时收缩高度并内部滚动；常规最小宽度约 220px、最大约 320px，窄视口以可用宽度为上限。长语言名称合理换行，不遮盖勾选或产生横向溢出。搜索框、列表正文、选中勾选、悬停背景及焦点样式统一适配，保留原语言排序与选择语义。

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

### R6：主题适配的可靠性与隔离

Discord 主题标记可能随站点更新变化，图片及渐变背景无法仅凭单一 CSS 颜色可靠判断。采用 D9 的分级回退，并用真实页面与背景判断测试覆盖；不承诺匹配所有第三方主题的精确色值，只保证深浅协调及对比度。

Portal 脱离局部作用域可能再次引入浅色菜单，修改共享主题则可能影响其他浮窗。采用 D10 的专属容器，并验收设置页与划词浮窗不受影响。性能验收覆盖主题监听清理和消息持续更新时不触发无关主题计算。

## Open Questions

原探索阶段决策已收敛。D9–D11 主题优化方案于 2026-09-05 获用户确认，并通过本次独立架构评审（结论：审查通过）。代码实施和自动验证已推进，真实浏览器验收未全部完成；详见 [主题实施验证记录](./theme-validation.md)。未完成的验收不得复用此前 D1–D8 的通过结果。
