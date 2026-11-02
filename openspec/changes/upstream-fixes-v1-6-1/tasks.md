## 1. 冻结实施环境与来源

- [x] 1.1 核对 `feat/1.6.1` 与业务起点 `4b50206132b9f0a09dce9951a928c6fefd99c34e`，保留用户改动及本提案；建立 `codex/upstream-fixes-v1-6-1` 隔离分支，必要时用 worktree，记录实际目标与增量比较 SHA。
- [x] 1.2 从官方仓库获取来源对象；验证 `upstream-fixes.md` 的24条来源与固定窗口关系，不能因 main 新增提交扩大范围；更新19条候选的等价/依赖初审和消费者映射。
- [x] 1.3 记录现有 `upstream-baseline.json`、空/非空选择性账本及重定向指纹；确认不进入 `feat/upstream-sync-*` 完整同步模式；保留前轮9.2/9.3/10.5状态。
- [x] 1.4 执行 `node .gitnexus/run.cjs analyze --index-only` 更新索引；对拟修改符号用 query/context 和编辑前 impact，报告调用方/流程/风险，HIGH/CRITICAL先告知，UNKNOWN源码补证；原始结果写入本变更 `evidence/impact.md`。
- [x] 1.5 先核对并恢复本机 pnpm 12.10.1 启动器（提案阶段发现路径失效），不升级仓库依赖；在 PowerShell 设置 `$env:SKIP_FREE_API='true'`，运行 `pnpm run test`、`pnpm run test --config vitest.fork.config.ts`、类型与边界基线；记录既有失败与 free-api 有意跳过，不把基线失败混为新回归。

## 2. 页面管理器与站点正文

本节各项仅在接纳对应候选后修改。每项先以最小行为测试证明旧实现失败，再按来源最小适配并运行相关测试至通过；已有等价则记录证据，阻断则记录缺失效果。编辑新符号前补 impact。P16 必须在 P03 相关门控适配后执行。

- [x] 2.1 P01：在 `src/utils/host/dom`、`src/utils/site-rules` 和 host `page-translation.ts` 回迁 LaTeXML 摘要规则；覆盖首次/动态翻译、去重、主题、取消和恢复，不改变通用 SVG/公式保护。
- [x] 2.2 P03：在 host `page-translation.ts` 及相邻 `__tests__/page-translation-mutations.test.ts` 覆盖 display:contents、shadow root、滚动容器和替换/移除；适配门控、取消和观察器释放，验证不会整页历史突发入队。
- [x] 2.3 P07：更新 `src/utils/site-rules/built-in/rules.json` 的 GitHub issue 标题规则，在 `src/utils/site-rules/__tests__/built-in.test.ts` 验证新旧目标与非目标内容。
- [x] 2.4 P16：在当前管理器、`src/types/config/site-rules.ts`、规则解析器与 DOM filter 回迁隐藏菜单规则及可见性门控；覆盖匹配/不匹配、规则 delta、打开前不抢先请求与后续打开翻译，避免目录整体迁移。
- [x] 2.5 P17：在 `translation-state.ts` 与既有 virtual-paragraph 生命周期测试验证顺序校验；加 GameFAQs 指定攻略规则和测试，证明长文本不反复复制扫描、其他 PRE 仍受保护。
- [x] 2.6 运行 `pnpm run test src/entrypoints/host.content/translation-control src/utils/host/dom src/utils/site-rules src/utils/host/translate/dom` 及本节新增相关测试，要求无新增失败；将最终来源贡献、部分适配或阻断回写来源清单。

## 3. 设置页与当前颜色选择器

- [x] 3.1 P02：核对 `src/entrypoints/options` 与 `src/fork/ui/options` 的实际消费者；先测试深链分组展开及现有跳转，再适配路由控制和链接语义，不新增快捷键或云服务页面。
- [x] 3.2 P04：在当前 `src/components/ui/base-ui/color-picker.tsx` 和对应 `__tests__/color-picker.test.tsx` 覆盖 Escape 后 blur 不提交、色相状态同步；最小回迁，不引入 `8167d4ba` 重写。
- [x] 3.3 P05：核对当前触发器可访问名称；缺失则补语义测试和最小名称，已有等价则记录无需变更；排除来源中的间距和外观贡献。
- [x] 3.4 P06：先覆盖“外部改变后恢复曾发出的值”与 pointercancel/lostpointercapture 后悬停，再修复旧回写标记及拖拽收尾；不将此作为悬浮按钮历史问题已修复的证据。
- [x] 3.5 运行 `pnpm run test src/components/ui/base-ui/__tests__/color-picker.test.tsx` 与对应设置测试、`pnpm run test --config vitest.fork.config.ts src/fork/ui/options`；记录来源结果和现有品牌外观保持情况。

## 4. 划词、全选、host 与页面提示

- [x] 4.1 P09：对 `src/entrypoints/selection.content/utils.ts`、朗读消费者及 fork 输入上下文链先加 ruby/br/预格式选区测试，再回迁去注音；同时验证不提前读取完整输入值、不扩大敏感控件范围。
- [x] 4.2 P10：在 `src/components/ui/selection-popover` 和 `src/utils/select-all.ts` 覆盖卡片关闭/拖动后的新选区、多 host 全选、可编辑控件；适配实际 fork 挂载路径，避免异步清空选区。
- [x] 4.3 P11：在 `src/utils/shadow-root.ts`、host toast 和 selection/side 实际入口覆盖隐藏/恢复/替换 body、嵌套 host 与卸载；回迁阅读模式兼容，验证可见性、全选及状态保留。
- [x] 4.4 P14：追踪 host、selection、side 与 `src/fork/ui/selection-content` 的 Toast provider/context/hook；先写单事件一次提示和功能保持的 fork 回归，再最小去重，避免混用上游与 fork Provider。
- [x] 4.5 运行选区/弹窗相关根测试及 `pnpm run test --config vitest.fork.config.ts src/fork/ui/selection-content src/fork/ui/side-content`，覆盖朗读、自定义动作、iframe、输入翻译；将来源贡献及生命周期结论回写清单。

## 5. YouTube 与 Shorts

- [x] 5.1 P08：在 `init-youtube-subtitles.ts`、caption-track listener、Shorts watcher/renderer 和 universal adapter 核对实际依赖；先测视频导航/切换/销毁，再适配按钮挂载及唯一监听，不移入分平台新配置。
- [x] 5.2 P12：检查 interceptor→消息→YouTube fetcher→字幕状态；补已有字幕不误报、真实无字幕、请求失败/取消及导航迟响应测试，再最小移植获取与状态修复，不回退至 AI 转录。
- [x] 5.3 P15：在 YouTube `noise-filter.ts` 及对应测试覆盖带音乐符号的真实歌词和纯噪声，回迁过滤修复。
- [x] 5.4 运行 `pnpm run test src/entrypoints/subtitles.content src/utils/subtitles` 及 fork `src/fork/upstream-services` 准入相关测试；确认 X/Netflix/AI转录保持关闭，登记P08/P12/P15实际结果。

## 6. 翻译结果与 Google 传输

- [x] 6.1 P13：先在 `text-preparation.ts` 的相关测试覆盖仅中英文空格差异和真正翻译，再回迁等价结果判断，避免吞掉有效译文。
- [x] 6.2 P18：对 `core/translation-modes.ts`、`core/translation-request.ts`、`api/google.ts` 添加仅译文 HTML 换行、缩进、列表和属性边界用例，打通保护参数与实际 fork 请求链。
- [x] 6.3 P19：在 P18 基础上覆盖连续标点、前后空白、普通文本/HTML、原文类似标记文本与占位符恢复，回迁保护逻辑，不改变整单元传输策略。
- [x] 6.4 在 `src/fork/page-translation` 新增或复用真实消费者回归，验证合批、缓存、术语有效集合/revision、MT/LLM分流、单条降级及重试；测试不得绕过实际重定向路径。
- [x] 6.5 运行 `pnpm run test src/utils/host/translate` 和 `pnpm run test --config vitest.fork.config.ts src/fork/page-translation`，记录 free-api 有意跳过，登记 P13/P18/P19 来源结果。

## 7. 贡献对账与完整工程门禁

- [x] 7.1 汇总19条候选最终状态、实际文件、测试与未获得效果；五条不适用保持原因。复查 `UPSTREAM_FOLLOW_UPS.md` 的历史事项，不以相似提交标题误标已解决；新证据路径避免 Windows 非法字符。
- [x] 7.2 按真实贡献更新 `src/fork/identity/selective-upstream-patches.json` 完整来源/最终LF指纹及需要更新的重定向指纹；多来源文件统一对账，不扩大通用allowlist，不改完整同步记录和CI。
- [x] 7.3 为实际用户修复新增 `.changeset/*.md`，包名 `@read-frog/extension`、patch级别，内容使用 `fix(...): ...`；不引入上游版本发布提交或擅改发行版本。
- [x] 7.4 设置实际目标 `FORK_DIFF_BASE`，执行 `node scripts/check-fork-boundary.mjs`、`node scripts/check-fork-brand.mjs`；核对官方来源祖先验真通过，失败不得通过改基准或盲刷指纹绕过。
- [x] 7.5 保持SKIP_FREE_API=true，执行完整根与fork测试、`pnpm run type-check`、`pnpm run fmt:check`；记录命令退出码、失败归因及跳过项，修复本轮引入的回归。
- [x] 7.6 按现有fork-guard发行矩阵完成国内三浏览器与已声明海外组合构建及产物断言，记录包路径、hash、edition/channel/浏览器和候选代码SHA，检查商业服务隔离。
- [x] 7.7 执行 `node .gitnexus/run.cjs detect-changes --scope all --repo .`；如存在本轮提交，再以冻结目标SHA执行compare检查；结果不得error/partial/truncated，逐项解释影响流程与遗留风险，未完成不得提交。

## 8. 真实浏览器验收与交接

- [ ] 8.1 用真实构建包验收 arXiv、GitHub issue、Telegram display:contents、CSS菜单、GameFAQs/长纯文本；覆盖翻译/仅译文/关闭恢复/取消及动态导航，记录场景和结果。
- [ ] 8.2 验收 Google 标点/换行、ruby 朗读/翻译、卡片关闭后新选区、全选、简悦隐藏body与恢复、Toast单次提示、设置深链和颜色取消/恢复/拖拽结束。
- [ ] 8.3 验收 YouTube 有字幕、无字幕、歌词、普通视频→Shorts→返回及字幕关闭/销毁；对照未开放平台不注入/不请求。
- [ ] 8.4 对照任译喵登录/会员、模型网关、术语编辑/删除、批处理和输入隐私；检查SW、扩展页及content script零上游商业请求。外部条件不足逐项记待验收，不伪造通过、不补签前轮任务。
- [x] 8.5 在 `evidence/validation.md` 汇总候选来源、代码和包绑定、命令/浏览器结果、跳过/待验收与回退方法；列出依赖阻断对应用户效果和后续决策，不将已审查等同已修复。
- [x] 8.6 复核没有额外产品/依赖/schema/完整基线变更，交付可审阅差异和验证结论；存在待验收不得声称发布就绪，不自动提交、推送、发布或归档。
