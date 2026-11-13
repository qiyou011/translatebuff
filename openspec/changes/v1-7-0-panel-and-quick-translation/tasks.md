# 1.7.0 面板与快捷翻译实施清单

目标：按 design.md 的方案 A 交付真实功能，视觉定稿另行补充。顺序为配置、执行链路、平台、界面、验收；新路径为拟新增文件，实施前由影响分析核定。涉及行为和持久化的任务先建立失败回归，再最小实现并验证。所有项初始未完成，不将规划完成计作实施完成。

## 1. 实施前证据与影响分析

- [x] 1.1 阅读 proposal.md、全部 delta specs、design.md、requirements-reference.md、FORK.md 和 AGENTS.md，确认用户覆盖原型的语言及次数规则，记录实施基线 SHA。
- [x] 1.2 恢复 GitNexus 引擎与索引兼容，检查索引新鲜度；不得把空结果、UNKNOWN 或版本错误作为低风险结论。
- [x] 1.3 对 loadForkConfig、migrateForkConfig、useInputTranslation、resolveInputTranslationLang、translateTextForInput、translateTextCore 及随后实际修改的 UI/字幕符号运行 upstream impact，记录调用者、流程和风险；HIGH/CRITICAL 先告知用户，UNKNOWN 补查证据后再编辑。
- [x] 1.4 核对原型模型目录与正式服务目录、现有翻译中心/兑换地址、文档地址状态；记录缺项及本期占位策略，不伪造服务可用性。

## 2. 独立配置与迁移（design D1–D2）

- [x] 2.1 在 `src/fork/config/__tests__/migration.test.ts` 建立缺失/旧版配置、具体与引用目标、两次初始化、保留间隔、禁用轮换及二次启动保留自选次数的失败用例；检查失败原因是新行为未实现。
- [x] 2.2 更新 `src/fork/config/schema.ts`、`constants.ts`、`migration.ts`，实现设计表中的独立语言、次数、颜色、版本与修订字段，复用主配置 provider/目标字段，运行迁移用例直至通过。
- [x] 2.3 新增 `src/fork/background/initialize-feature-config.ts` 并接入 `src/fork/background/index.ts` 的主配置完成后时机；调整 `src/fork/config/storage.ts`，实现唯一迁移入口、初始化屏障和幂等恢复，禁止页面各自写默认值。
- [x] 2.4 在 `src/fork/config/__tests__/storage.test.ts` 验证中断恢复、并发更新和延迟旧快照，接入现有 fork 消息通道的字段补丁/修订校验及双存储订阅，确保不发布半套状态。
- [x] 2.5 新增 `src/fork/config/backup.ts` 和对应测试；从 `src/entrypoints/options/pages/preference/config/` 的导入导出、重置及 `src/entrypoints/background/config-backup.ts` 接入最小 fork 包装，覆盖新旧格式、失败恢复、全重置与单功能范围，不恢复会员凭据。

## 3. 功能配置贯通（design D3）

- [x] 3.1 新增 `src/fork/config/feature-config.ts` 及 `__tests__/feature-config.test.ts`，验证四功能语言隔离、provider 唯一来源、共享上下文能力过滤及稳定修订快照。
- [x] 3.2 在 `src/fork/ui/selection-content/` 的实际划词调用接缝接入独立语言；用集成测试证明划词请求参数改变而网页配置不变，不仅断言选择器值。
- [x] 3.3 新增 `src/fork/ui/selection-content/input-translation/execute-input-translation.ts`，使用稳定 provider/具体语言/限定上下文调用既有核心；核对术语、缓存、换行、会员与 hostedFeature 参数，禁止复制翻译引擎。
- [x] 3.4 测试输入请求期间提供商或目标变化不会混用参数；使失效请求不能写回，新请求读取新配置；核对缓存隔离实际语言对与上下文。

## 4. 输入语言、触发及反馈（design D4）

- [x] 4.1 在 `src/fork/ui/selection-content/input-translation/__tests__/resolve-lang.test.ts` 新增草稿识别、检测失败不请求、固定目标、同语言提示及检测期间切会话用例。
- [x] 4.2 调整 `resolve-lang.ts` 和 `use-input-translation.ts`，仅检测草稿、使用具体用户目标、移除 fork 轮换行为；检测失败显示确认文案，不回退网页或聊天语言，运行 4.1 用例通过。
- [x] 4.3 将触发逻辑接入 2～5 次配置，补足 `use-input-translation.test.tsx` 中次数、间隔、重复触发、IME、粘贴/拖放及原始空白快照回归。
- [x] 4.4 修改 `input-translation-bar.tsx`、会话类型及 hook，让 detecting/translating 立即显示等待；固定目标也显示完成条，来源标签按“已设置/手动选择”，临时重译不改持久目标。
- [x] 4.5 扩展 `input-translation-bar.test.tsx` 与 hook 回归，验证失败/超时/取消/空结果退出等待、旧 finally 隔离、编辑后撤销、失焦恢复、菜单 Esc、真实发送与换行区分；复用 `input-translation-error.ts` 分级。

## 5. 六平台编辑器与上下文（design D5）

- [x] 5.1 在现有 `chat-context-sites.ts`、`telegram-context.ts` 和 `replace-telegram-draft.ts` 基础上定义适配器契约，验证元素与所属会话绑定，普通 provider 不提取模型上下文。
- [ ] 5.2 获取 Discord、Telegram 实页 DOM 证据，复核已有输入与写回流程，补回归保证取消聊天决定语言后上下文仍正确供模型使用。
- [x] 5.3 新增 `src/fork/ui/selection-content/input-translation/platforms/youtube.ts` 及夹具测试，覆盖适用评论/聊天编辑器与上下文归属。
- [x] 5.4 新增同目录 `x.ts` 及夹具测试，覆盖适用发帖/回复/聊天输入与会话切换，不共享其他编辑器草稿。
- [x] 5.5 新增同目录 `whatsapp.ts` 及夹具测试，覆盖当前会话上下文、受控输入写回与同 DOM 换会话。
- [x] 5.6 新增同目录 `reddit.ts` 并复用已有 `__tests__/reddit-input-translation.test.tsx`，覆盖适用评论/发帖编辑器及安全写回。
- [ ] 5.7 六平台分别回归 DOM 卸载、SPA 切换、多输入框、继续编辑、语言重译与撤销；适配器选择器须来自真实页面，记录各输入场景的适用范围。

## 6. 面板、提供商及设置联动（design D6）

- [x] 6.1 更新 `src/fork/ui/popup/App.tsx` 与功能快捷设置组件，网页常驻、其余按功能打开，复用现有 UI 原语，测试关闭/外点/Esc 和焦点恢复，配置不因关闭丢失。
- [x] 6.2 接入真实网页翻译状态、恢复原文和站点开关；验证站点禁用同时阻止自动翻译及内容端在途写入，限制页和服务失败不显示成功。
- [ ] 6.3 更新 `src/fork/components/provider-selector.tsx`、`provider-selector-groups.ts` 及 fork 设置选择器，共用分版目录、分组、能力与会员门禁；补目录空态、失配、默认值及已有选择保持测试。
- [x] 6.4 将 `src/entrypoints/options/pages/input-translation/` 的语言与触发界面通过符合边界的 fork 接缝接入固定源、用户目标及次数选择；移除轮换入口，面板教程和完整设置同步。
- [x] 6.5 接入 `src/entrypoints/options/app-sidebar/features-nav.tsx` 与真实路由，按当前功能展开/选中；划词定位悬浮工具，翻译分组默认展开，保留手动折叠。
- [x] 6.6 沿用账户/用量页、海外兑换及翻译中心地址，隐藏面板消息/帮助入口；按 2026-11-12 用户确认，第四项采用 Figma「漫画/图片翻译 · 敬请期待」禁用占位；核对国内外名称、版本和外链行为。
- [x] 6.7 统一功能名称、教程、平台名称及失败文案的本地化；展示六平台可访问图标，国内平台说明按原型原文配置，海外不显示国内说明。

## 7. 字幕、品牌与颜色（design D7）

- [x] 7.1 接入 `src/entrypoints/subtitles.content/universal-adapter.ts`、`translated-subtitles-downloader.ts` 及实际队列接缝的功能快照；测试翻译参数、缓存命中隔离、重试和下载语言元数据，不临时修改全局语言。
- [x] 7.2 核对 `src/fork/upstream-services/subtitles.ts`、`netflix-subtitles.ts` 与 `src/entrypoints/subtitles.content/platforms/` 的准入，支持三平台已有字幕，保留无字幕状态且不开放 AI 无字幕识别。
- [x] 7.3 接通字幕快捷设置与完整设置，验证功能禁用和播放器译文开关互不混淆；两版平台范围一致、说明按发行版显示，不保留测试版标识。
- [x] 7.4 在 `src/fork/ui/selection-content/` 的实际工具栏接入正式品牌资源、翻译/朗读及键盘提示；输入等待和完成保留标识，不将视觉定稿算作本项验收。
- [x] 7.5 在 `src/entrypoints/options/pages/translation/translation-style/` 经 fork 接缝接入文字颜色选择/预览和持久保存；通过既有样式更新通道更新实际译文，保留 customCSS 和其他预设。
- [x] 7.6 增加颜色配置行为测试，断言选色、取消、切预设、重开、无效导入和原文不变；以翻译调用计数为零验证无需重译。

## 8. 集成与交付验证

- [ ] 8.1 设置 `$env:SKIP_FREE_API='true'`，运行 `pnpm exec vitest run src/fork/config src/fork/ui/selection-content/input-translation`，再运行相关主/fork 集成测试；新测试应先因目标行为缺失失败，实现后通过，live free-api 有意跳过。
- [x] 8.2 运行 `pnpm run test` 与 `pnpm run test --config vitest.fork.config.ts src/fork`，覆盖真实 fork 路径；记录失败和环境缺项，不以主套件替代 fork 验证。
- [x] 8.3 运行 `pnpm run type-check`、`pnpm run fmt:check`，结合实施基线运行 `FORK_DIFF_BASE` 对应边界检查和 `node scripts/check-fork-brand.mjs`；必要接缝按 FORK.md 登记，不盲刷指纹。
- [x] 8.4 运行 `node scripts/pack.mjs test --edition cn` 与 `node scripts/pack.mjs test --edition global`，使用现有产物断言验证两版入口、模型范围及禁用上游能力；不提交商店。
- [ ] 8.5 使用实包验收六个平台的翻译/上下文/输入写回，以及 YouTube、X、Netflix 字幕及下载；按平台和编辑器记录结果，不向公共会话发送测试消息。
- [ ] 8.6 验收升级、配置损坏恢复、旧备份/新版备份导入、全重置、并发页面修改、后台重启及禁用网站；确认用户后选次数不被覆盖。
- [x] 8.7 新增 `.changeset/*.md`，目标 `@read-frog/extension`，内容使用 conventional commit 格式；对齐 fork 版本来源，不误改上游引擎版本作为产品版本。
- [x] 8.8 提交前运行 `node .gitnexus/run.cjs detect-changes --scope all --repo .`，必须无 partial/truncated；有提交时用 conventional commit 格式，记录最终验收证据、剩余外部依赖和回退方法。

## 9. 视觉补充（2026-11-12）

用户已提供 Figma v1.7.0 节点清单并授权 UI 还原。本轮补充主面板与三个快捷弹层、输入设置、颜色与预览设置、划词工具栏/浮窗、输入加载及完成反馈的浅深色 UI，使用 Figma 导出的本地素材。第四个入口采用漫画/图片翻译禁用占位。输入反馈位置仍遵守既有规格，位于输入框上方。模型服务目录缺项继续等待正式接口，真实平台及登录会员状态验收仍另行安排；本地截图与夹具不替代这些验收。

## 本地交付状态（2026-11-10）

完成 40/46 项。平台适配器与夹具已实现；5.2、5.7、8.5 和 8.6 的实页/实包部分按用户安排另行验收，不能用本地夹具替代真实选择器证据。6.3 的倍率、国内/海外分类和顺序由用户明确暂缓，等待正式接口。视觉稿继续待审。

8.1 的指定本地测试及完整主/fork 套件均已通过，但部分补充集成用例是在实现后加入，没有完整的逐条 test-first 记录，因此此过程项保留未勾选；不影响已记录的当前行为验证。8.6 的迁移、损坏恢复、备份、全重置、并发修改、恢复日志和站点禁用已完成自动化回归，真实浏览器升级/后台重启操作仍待实包验收。5.3–5.6 勾选仅代表本地适配器和覆盖所列场景的契约夹具完成，实站兼容性由 5.7/8.5 验收。
