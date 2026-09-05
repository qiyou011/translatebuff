> 全程 TDD：先写失败测试并跑出真实红灯，再写实现。本地跑测试须设 `SKIP_FREE_API=true`；测试可显式覆盖官网环境变量，不删除用户 `.env`。
> 分支 `feat/fork-foundation-input-trans`，不并回 `change/fork-foundation`。2026-09-05 用户确认采用 fork 自持方案，历史 PR#1 / PR#2 标签仅保留溯源；本轮不提交、不推送。
> 2026-09-05 自动复盘已沉淀至 [notes/retrospective.md](./notes/retrospective.md)。实施任务仍为 58/62：6.3、6.4、8.6、8.8 保持未完成。复盘完成不代表交付或归档完成。

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

- [x] 4.1 在 `use-input-translation.ts` 的 `enableCycle` 互换之后、调用 `translateTextForInput` 之前插入解析；配置经 `getLocalConfig()` 取得（**不得用 atom 切片拼 `Config`**，见 D6）
- [x] 4.2 若把 `language` 加入 atom 依赖，同步补齐 `handleTranslation` 的 `useCallback` deps（`sourceCode` / `targetCode`）
- [x] 4.3 写失败测试：解析后两端语言相同时，在调用引擎**之前**短路并弹 toast「与目标语言相同，未翻译」，且不显示 spinner
- [x] 4.4 实现该短路分支
- [x] 4.5 跑全量测试与三个 build，确认 `translate-variants.ts` 一行未改
- [x] 4.6 提交（PR#1 待上游提交时整理）

## 5. 内联条 UI（PR#2）

- [x] 5.1 写失败测试：翻译成功替换后挂出内联条，显示解析出的语言并按 `source` 标注「自动检测」/「按网页源语言」
- [x] 5.2 实现内联条组件，状态为 `{ element, originalText, translatedText, resolvedLang, langSource } | null`，挂 shadow root，绝对定位于输入框上方
- [x] 5.3 写失败测试：翻译期间用户改动输入导致放弃替换时，**不**挂内联条
- [x] 5.4 实现该分支；确认竞态保护仍用闭包局部变量，state 仅在替换成功后写一次
- [x] 5.5 写失败测试：撤销还原原始文本；元素已不在文档中时撤销不产生写入
- [x] 5.6 写失败测试：在 A 输入框翻译后切到 B 输入框，撤销不得写入 B
- [x] 5.7 实现撤销与元素归属校验
- [x] 5.8 写失败测试：下拉改语言后以**原始文本**重译并替换
- [x] 5.9 实现改语言重译；交互用 `mousedown` + `preventDefault`（避免 blur 先于 click 销毁条子）
- [x] 5.10 实现跟随定位：滚动、输入框多行长高、窗口缩放；SPA 切频道时销毁
- [x] 5.11 同语言提示改为输入框上方的同款提示条（无撤销按钮），与需求原型一致
- [x] 5.12 提交，整理为 PR#2 提交给上游
- [x] 5.13 补自动化测试：翻译成功后用户删除、修改或新增译文内容，再点击撤销，始终恢复三空格触发前保存的 `originalText`；同时断言译文编辑不会覆盖原文快照，也不会仅因内容变化关闭内联条
- [x] 5.14 写失败测试：译文内联条在焦点真正移出输入框、内联条和语言菜单交互范围后关闭；焦点进入内联条或 Portal 菜单时不得误关
- [x] 5.15 写失败测试：消息实际发送和菜单关闭状态下按 Esc 会关闭内联条；换行不关闭；语言菜单展开时第一次 Esc 只关闭菜单
- [x] 5.16 实现译文内联条的失焦、实际发送与分层 Esc 生命周期，同时保留用户编辑译文后的撤销能力
- [x] 5.17 写失败测试并实现同语言提示在继续输入、消息实际发送、按 Esc 或真正失焦时关闭
- [x] 5.18 写失败回归测试：真正失焦只隐藏翻译内联条，重新聚焦原输入框后恢复；聚焦其他输入框不显示；发送或 Esc 后重新聚焦不得恢复
- [x] 5.19 将翻译会话状态与显示状态分离，失焦时保留 `element` 和 `originalText`，仅在原输入框重新获得焦点时恢复

## 6. fork 自持落位（2026-09-05 用户确认执行，不再以上游拒绝为前提）

- [x] 6.1 把新增模块及对应测试搬到 `src/fork/ui/selection-content/input-translation/`，fork App 只挂载 fork hook；专用语言菜单组合 Base UI 原语并复用上游列表/输入组件，恢复上游 hook、index 和两个共享 Combobox 文件（无需重定向或扩 allowlist）
- [x] 6.2 新增上游漂移哨兵，记录 hook、index、共享语言选择器与 Combobox 四份已评审文件的 sha256；已验证恢复前 4 红、恢复后 4 绿，更新指纹必须先人工对账
- [ ] 6.3 `FORK_DIFF_BASE=<base> node scripts/check-fork-boundary.mjs` 必须通过
  - 当前工作树完整特性文件集按同一分类器核验：源码违规为 0；仍有 3 个既有 changeset 被拦截，未擅自删除或扩 allowlist。原 CLI 只读提交，当前未提交迁移不能用 HEAD 检查代替。完整门禁暂不勾选。
- [ ] 6.4 提交
- [x] 6.5 迁移后重新跑功能测试、全量测试、类型检查、Chrome 构建及源文件边界核验（94 项功能测试、3298 项全量通过/4 跳过；四份上游源码与基线一致；完整边界仍有既有 changeset 策略问题，见 6.3）
- [x] 6.6 浏览器实证迁移后的三空格翻译、菜单搜索/键盘、失焦恢复、原文重译和编辑后撤销；记录产物与截图，不发送聊天消息（Chrome 152 全新配置、生产构建、本地泰语测试页与真实翻译服务；不等于登录态 Discord 验收，详见 fork-migration-validation.md）
  - 后续已在主 Chrome 的真实 Discord 泰语频道，以重新构建并重载的 `chrome-mv3-dev` 补验核心链路、纯文本粘贴、清空译文后撤销与分层 Esc；原草稿已恢复，未发送消息。当前深色主题补验不替代 8.8 完整矩阵或主 profile 的 production 包验收。

## 7. 交付验收

> 以下已勾选项记录主题优化前的验收，不涵盖新增任务组 8。新增方案须完成 8.8–8.9 后才可宣称交付。

- [x] 7.1 `SKIP_FREE_API=true pnpm run test` 全绿（移除本地 `.env`）
- [x] 7.2 `pnpm run type-check` 通过
- [x] 7.3 `pnpm run build` / `build:edge` / `build:firefox` 三个全过
- [x] 7.4 真机验证：用户已验收通过
- [x] 7.5 与需求仓 v1-3-0-input-translation-chat-context 对账完成，UI 三处差异已补齐

## 8. 输入区域主题与语言菜单优化（2026-09-05 用户确认，搜索焦点阻断已修复，其余实页验收仍待完成）

- [x] 8.1 恢复与现有索引兼容的 GitNexus 工具；实施前对 `InputTranslationBar`、`LanguageCombobox` 及拟修改的相关符号做 upstream impact，记录调用方、流程与风险。HIGH / CRITICAL 先告知用户，UNKNOWN 继续核实，不以空结果放行
- [x] 8.2 在真实 Discord 深浅主题页面确认主题标记及所在元素；复核 D9–D11 的局部主题和 Portal 边界，记录技术评审结论，不复用旧审查作为本次通过证据（Dark / Light / Onyx 标记已实测；详见 theme-validation.md）
- [x] 8.3 补主题判断回归测试：站点主题优先、深浅及深色变体、标记未知时背景判断、透明及半透明祖先、图片与渐变回退，确认失败后实现输入翻译专用主题模块
- [x] 8.4 实现局部主题更新与有限属性监听，覆盖首次显示、重新聚焦、菜单打开和页面主题变化；补元素替换、卸载清理测试，确保无消息树全量监听或持续轮询
- [x] 8.5 实现输入翻译专属主题作用域与 Portal 容器，使菜单与条体共享主题；补菜单打开时主题切换保留焦点、搜索、选中语言及会话的回归验证，不修改全局主题或用户配置
- [ ] 8.6 按 D11 更新内联条、同语言提示、菜单和搜索框配色，完善撤销悬停、键盘焦点及菜单选中态；实测普通文字对比度至少 4.5:1
- [x] 8.7 共享语言选择器按需增加兼容的可选参数；输入翻译菜单向上展开、常规宽度约 220–320px、受视口限制并内部滚动，长名称不溢出或遮盖勾选
- [ ] 8.8 真实 Chrome Discord 验证深色、浅色、主题与扩展设置不一致、菜单打开时切主题、窄窗口、长语言名称，以及三空格翻译、失焦恢复、分层 Esc、原文重译和编辑后撤销；记录加载路径、重载状态和原始截图，并检查设置页、划词浮窗未受影响
  - 复盘对账：迁移后主 Chrome 最新 dev 的深色核心回归已通过，详见 fork-migration-validation.md；其他主题组合、窄窗口/长名称、关联入口及独立截图归档仍未补齐，保持未勾选。
- [x] 8.9 执行相关测试、类型与格式校验及必要构建，测试设 `SKIP_FREE_API=true`；更新用户可见修复的 changeset，运行 OpenSpec 严格校验；提交前完成 GitNexus `detect_changes(scope=all)`，不得将 partial / truncated 结果当作通过
