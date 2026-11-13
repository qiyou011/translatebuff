当前实施进度与明确未通过项见 evidence/implementation-status.md。已开始正式实现；以下未勾选任务包含尚未完成的逐项证据，不能以部分实现视为完成。

# 网页双语格式保留实施任务

本清单依据 proposal.md、design.md、specs/webpage-bilingual-format-retention/spec.md 和 acceptance-matrix.md。实际进度以下方勾选及证据为准。路径相对 `D:/project/translatebuff`；证据存放本变更目录 `evidence/`。用户最新指令要求放弃官方资源路线并继续实施；正式集成继续推进，最终双服务正常 P0 交付门槛保留。编码任务按“先写失败契约测试、确认失败原因、最小实现、针对性测试通过”推进。

## 1. 基线、影响分析与服务可行性

- [x] 1.1 记录当前提交、未提交改动、工具链与现有测试基线，隔离本变更文件；定位原型的原反馈网站、测试台和样例，核对 acceptance-matrix.md 的原型哈希，不覆盖其他任务工作。用户授权重新确定基线：采用 evidence/acceptance-baseline.md 中的重建测试台与当前原站快照。
- [x] 1.2 更新 GitNexus 索引，对 createPageTranslationRequest、translateVirtualParagraph、requestMicrosoftTranslationBatch、队列入口、原子恢复及实际缓存写入者逐一执行 upstream impact；记录调用者、流程和风险，完整处理截断／UNKNOWN，HIGH／CRITICAL 编辑前告知用户。
- [x] 1.3 创建前置实验记录，按 design.md D2 为微软候选整段标记编码准备语序交换、重复词、强调、代码／公式及批量样本；通过真实 src/fork/page-translation/queues.ts 路径验证，不删除现有通用 HTML 保护。实验已完成，候选未通过；结果见 evidence/provider-feasibility-round2.md，不等于 1.7 放行。
- [ ] 1.4 验证谷歌现有 HTML 请求与属性保护的复用边界，记录正常和损坏响应，确认段落上下文、可见换行及原子内容不被破坏。已记录实际重复原子反例与守卫复用边界，尚不能确认内容完全不受破坏，保持未勾选。
- [x] 1.5 按用户确认的评估范围准备微软官方认证 HTML 实验：固定 9 个完整段落样本、三种目标语、请求项/字符上界、无凭据请求清单和离线安全校验；不创建资源、不联网消耗额度、不修改生产入口。见 evidence/official-channel-request-plan.json 和 official-channel-offline-verification.json；计划 3 请求/27 翻译项/7554 字符上界，实际官方请求 0 次。
- [x] 1.6 用户于 2026-11-13 明确不采用官方资源路线，撤销其执行前置条件；未创建资源、未调用官方接口，历史准备证据保留。
- [ ] 1.7 结合现有免费通道正式集成和真实浏览器结果输出双服务结论，完成正常 P0 语义验收；已知标记反例继续保留，不能用降级代替完成。

## 2. 共享格式提取与完整性契约

- [ ] 2.1 新增 src/utils/host/translate/dom/**tests**/bilingual-format.test.ts，从原型 source 构造 F01—F08、F20、F24—F27 输入，覆盖标准／计算样式粗体高亮、原子保护、重复词与嵌套边界；运行测试并记录预期失败。
- [ ] 2.2 新增 src/utils/host/translate/dom/bilingual-format.ts，实现 design.md D1／D3 的确定性格式描述、原子表和格式指纹；复用既有段落分割，确保 2.1 通过。
- [x] 2.3 增加缺失、重复、新增、交叉标记及源文字仿造标记的失败用例，实现响应完整性校验；验证代码字符和公式位置，不允许缺失原子末尾补回。
- [ ] 2.4 在对应段落分割测试中加入 F10—F16 的 br、预格式空行、源码换行、嵌套列表、表头／标题／单元格和引用边界；最小修复必要提取差异并运行针对性测试。

## 3. 双服务请求与批处理接入

- [ ] 3.1 新增 src/fork/page-translation/**tests**/bilingual-format-adapter.test.ts，使用阶段 1 真实响应样本测试两服务编码／解码、项目顺序和单项失败隔离；加入“同一段落只有一个翻译单元”的断言。
- [ ] 3.2 新增 src/fork/page-translation/bilingual-format-adapter.ts，按已验证协议分别适配谷歌和微软；仅为指定双语用途启用，维持通用微软 HTML 禁止行为，通过 3.1。
- [ ] 3.3 接通 core/translation-request.ts、translate-variants.ts 和实际 fork queues.ts 的请求快照及格式用途传递；加入真实队列集成测试，验证单条与批量采用同一规则，不波及字幕、划词和输入翻译。
- [ ] 3.4 接通 core/translation-modes.ts 的普通与虚拟段落；补充虚拟段落格式／换行用例和仅译文、大模型、其他服务的隔离回归。
- [x] 3.5 编写并实现 normal/degraded/failed 状态及最多一次受控纯文本恢复流程；测试取消、重复失败、原子损坏和重试预算，禁止恢复循环或占位符泄露。

## 4. 缓存准入与去重

- [ ] 4.1 在 in-memory-translation-cache.ts 对应测试及后台队列测试中加入同文异格式、不同服务／语言／模式／规则版本、相同原子编号不同内容的隔离用例，确认现有行为不足。
- [x] 4.2 沿 translate-text.ts、in-memory-translation-cache.ts、src/entrypoints/background/translation-queues.ts 及已定位持久缓存写入者贯通格式身份；批处理去重采用相同键语义，通过 4.1。
- [x] 4.3 在每一成功缓存写入前校验结果；测试损坏响应和降级结果不写正常格式缓存，缓存命中重新绑定当前映射，不缓存 DOM 引用，旧规则记录不能误命中。

## 5. 安全渲染、展示与生命周期

- [ ] 5.1 在 dom/**tests**/translation-insertion.test.ts 增加未知标签、脚本、事件、重复 ID、恶意样式、控件克隆和错误原子位置用例；实现白名单 DOM 重建，通过安全契约测试。
- [ ] 5.2 将安全渲染接入 dom/translation-insertion.ts 和 dom/virtual-paragraph-insertion.ts，保留原节点与所属容器；验证 F09—F22 原链接、定位、图标、表格及控件不受破坏，隐藏过滤不泛化。
- [ ] 5.3 基于现有 ui/style-injector.ts 和 fork 字色配置补充局部样式优先级，测试用户字色覆盖与高亮共存、标题／正文／代码区别；对 P1 格式逐项实现或记录限制。
- [ ] 5.4 在虚拟段落生命周期及页面控制器测试中模拟正文更新、原节点删除、恢复原文、服务／模式切换和乱序响应；贯通 session／revision／isCurrent 检查，保证旧结果不回插和单段译文唯一。
- [ ] 5.5 增加格式变化但文字相同的失效用例，以及异步装饰期间页面变化和插件自身变更观察用例；验证无重复翻译循环。
- [ ] 5.6 验证 F22／F23 点击计数、勾选、折叠和新增段落在恢复及重复翻译后保留；只清理插件拥有的节点，不覆盖原控件状态。

## 6. 自动验证与真实浏览器验收

- [ ] 6.1 设置 SKIP_FREE_API=true，运行新增契约、API、队列、缓存和普通／虚拟段落针对性测试，记录结果；修复本变更引入的问题。
- [ ] 6.2 执行 pnpm test、pnpm type-check、pnpm build 及本次文件格式／项目 fork 边界检查；将基线失败与新增失败分开，free-api.test.ts 明确为有意跳过，不伪称真实服务验证。
- [ ] 6.3 使用实际构建扩展在受控页和原反馈网站逐组完成谷歌 F01—F27 子项验收，记录环境、语言、配置、缓存、截图／DOM证据，核对语义对应与字体回退。
- [ ] 6.4 独立完成微软同一验收矩阵；不复用谷歌通过结论，正常 P0 失败不得以降级替代，P1 与未承诺新增项分别记录。
- [ ] 6.5 在浏览器验证动态新增、重复翻译、切换服务／模式、恢复、失败重试、窄容器及混排长段落；回归仅译文、大模型、原站控件和既有公式能力，检查额外请求和观察器循环。

## 7. 交付记录

- [ ] 7.1 将两服务子项证据回填 acceptance-matrix.md，汇总尚未完成／降级／P1 限制；仅所有正常 P0 满足时宣称产品完成。
- [x] 7.2 为 @read-frog/extension 添加本功能 changeset，正文采用 feat(translation): 等 conventional commit 格式；不按历史变更名自动修改版本号。
- [ ] 7.3 核对本变更 diff、通过 OpenSpec 严格校验；任何提交前执行完整无截断 detect_changes，明确风险及回滚方式，只纳入本变更文件，不提交其他工作区改动。

## 测试命令与预期

PowerShell 中先执行 `$env:SKIP_FREE_API='true'`。以下为正式实施阶段命令；当前只运行基线/证据测试和显式开启的前置实验，尚未完成正式产品全量与构建验收：

```powershell
pnpm exec vitest run src/utils/host/translate/dom/__tests__/bilingual-format.test.ts
pnpm exec vitest run src/fork/page-translation/__tests__/bilingual-format-adapter.test.ts
pnpm exec vitest run src/utils/host/translate/dom/__tests__ src/utils/host/translate/core/__tests__
pnpm exec vitest run src/utils/host/translate/api/__tests__ src/utils/host/translate/__tests__/in-memory-translation-cache.test.ts
pnpm test
pnpm type-check
pnpm build
jy-openspec validate v1-6-3-webpage-format-retention --strict
node .gitnexus/run.cjs detect-changes --scope all --repo .
```

新增测试在实现前应因对应功能缺失而失败，实现后通过；最终全量检查不得有本变更引入的失败。缓存与队列测试另运行阶段 4 实际定位／新增的测试文件。GitNexus partial／truncated 不是通过，须重跑或分页补齐；真实网络实验单独执行，不通过解除 SKIP_FREE_API 运行全量外部服务测试来替代。
