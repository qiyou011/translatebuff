> 全程 TDD：先写失败测试并跑出真实红灯，再写实现。本地跑测试须设 `SKIP_FREE_API=true` 并移除本地 `.env`。
> 分支 `feat/fork-foundation-input-trans`，不并回 `change/fork-foundation`；PR#1 / PR#2 分别提给上游 read-frog。

## 1. 站点 → 对话选择器映射（PR#1）

> 原计划给站点规则加 `chatContextSelectors` 字段，实施时发现 `SiteRule = z.infer<typeof siteRuleSchema>`
> 而该 schema 在 `src/types/config/site-rules.ts`（A 类·绝不改），与 D1 否掉枚举值是同一条红线。
> 改为独立映射表：零 A 类改动，且主路径与后备路径共用同一份实现，消除数据源分叉。
> 噪音排除项不重复一份，仍取站点规则已维护好的 `excludeSelector`。

- [x] 1.1 写失败测试：`getChatContextSelector` 对 Discord 频道页返回消息选择器，对发现页 / 未登记站点 / 非法 URL 返回 `null`
- [x] 1.2 实现 `src/utils/content/chat-context-sites.ts`，复用现成的 `urlMatchesPattern` 做站点匹配
- [x] 1.3 提交

## 2. 对话语言检测（PR#1）

- [x] 2.1 写失败测试：jsdom 构造 Discord 形态 DOM，`detectChatContextLanguage` 对纯日语对话返回 `jpn`
- [x] 2.2 实现 `detectChatContextLanguage(doc, rule, limit = 5)`：取选择器末尾 5 条 → 克隆并剔除 `excludeSelector` 命中的子孙 → 拼接 → `detectLanguage(text, { enableLLM: false })`
- [x] 2.3 补测试：韩语在前日语在后时取末 5 条判为 `jpn`
- [x] 2.4 补测试：消息不足 5 条、无消息节点、全为表情与链接（返回 `null`）
- [x] 2.5 补测试：消息含时间戳与用户名时被剔除；含 @提及的俄语消息仍判为 `rus`（已知限制的兜底断言）
- [x] 2.6 补测试：5 条极短 CJK 消息拼接不足 `DEFAULT_MIN_LENGTH = 10` 时返回 `null`
- [x] 2.7 提交

## 3. 语言解析上提（PR#1）

- [x] 3.1 写失败测试：`resolveInputTranslationLang` 对 `"targetCode"` 返回 `{ code: 全局目标语言, source: "explicit" }`
- [x] 3.2 实现 `resolveInputTranslationLang(lang, config, url, doc)`，**作为可复用导出**（R3 硬约束，不得埋进 hook）
- [x] 3.3 补测试：源语言为「自动」且站点有选择器 → `source: "chatContext"`
- [x] 3.4 补测试：源语言被钉死为具体语种 → 直接返回该码且**不执行**检测（`source: "explicit"`，断言检测函数未被调用）
- [x] 3.5 补测试：检测返回 `null` → 回退整页源语言，`source: "pageSource"`
- [x] 3.6 解析器与语言落在 from/to 哪一位无关（`enableCycle` 的位置差异在调用层，见任务组 4）
- [x] 3.7 提交

## 4. 接入调用层（PR#1）

- [ ] 4.1 在 `use-input-translation.ts` 的 `enableCycle` 互换之后、调用 `translateTextForInput` 之前插入解析；配置经 `getLocalConfig()` 取得（**不得用 atom 切片拼 `Config`**，见 D6）
- [ ] 4.2 若把 `language` 加入 atom 依赖，同步补齐 `handleTranslation` 的 `useCallback` deps（`sourceCode` / `targetCode`）
- [ ] 4.3 写失败测试：解析后两端语言相同时，在调用引擎**之前**短路并弹 toast「与目标语言相同，未翻译」，且不显示 spinner
- [ ] 4.4 实现该短路分支
- [ ] 4.5 跑全量测试与三个 build，确认 `translate-variants.ts` 一行未改
- [ ] 4.6 提交，整理为 PR#1 提交给上游 read-frog

## 5. 内联条 UI（PR#2）

- [ ] 5.1 写失败测试：翻译成功替换后挂出内联条，显示解析出的语言并按 `source` 标注「自动检测」/「按网页源语言」
- [ ] 5.2 实现内联条组件，状态为 `{ element, originalText, translatedText, resolvedLang, langSource } | null`，挂 shadow root，绝对定位于输入框上方
- [ ] 5.3 写失败测试：翻译期间用户改动输入导致放弃替换时，**不**挂内联条
- [ ] 5.4 实现该分支；确认竞态保护仍用闭包局部变量，state 仅在替换成功后写一次
- [ ] 5.5 写失败测试：撤销还原原始文本；元素已不在文档中时撤销不产生写入
- [ ] 5.6 写失败测试：在 A 输入框翻译后切到 B 输入框，撤销不得写入 B
- [ ] 5.7 实现撤销与元素归属校验
- [ ] 5.8 写失败测试：下拉改语言后以**原始文本**重译并替换
- [ ] 5.9 实现改语言重译；交互用 `mousedown` + `preventDefault`（避免 blur 先于 click 销毁条子）
- [ ] 5.10 实现跟随定位：滚动、输入框多行长高、窗口缩放；SPA 切频道时销毁
- [ ] 5.11 用内联条提示取代 4.3 的 toast
- [ ] 5.12 提交，整理为 PR#2 提交给上游

## 6. 后备方案落位（仅在上游明确不合并时执行）

- [ ] 6.1 把新增模块搬到 `src/fork/`，在 `src/fork/ui/selection-content/App.tsx` 换用 fork 版 hook（无需 `FORK_UI_REDIRECTS` 条目、无需 allowlist）
- [ ] 6.2 新增一个把上游 `use-input-translation.ts` 内容 sha256 钉死的测试，换回上游改动时的响亮告警（R2）
- [ ] 6.3 `FORK_DIFF_BASE=<base> node scripts/check-fork-boundary.mjs` 必须通过
- [ ] 6.4 提交

## 7. 交付验收

- [ ] 7.1 `SKIP_FREE_API=true pnpm run test` 全绿（移除本地 `.env`）
- [ ] 7.2 `pnpm run type-check` 通过
- [ ] 7.3 `pnpm run build` / `build:edge` / `build:firefox` 三个全过
- [ ] 7.4 真机验证：Discord 俄语频道、日语频道、中文频道（同语言提示）、源语言钉死场景、多输入框撤销
- [ ] 7.5 与需求仓 v1.3.0 的 `proposal.md`（PM 产出，MUL-85）比对，确认功能点无缺漏
