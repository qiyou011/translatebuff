## Why

微软删除了旧鉴权端点 `edge.microsoft.com/translate/auth`（实测 404），任译喵仍在调用它——**用户只要选中微软翻译，请求就必然失败**，线上功能已完全不可用。

上游 read-frog 已在 `f4bcbf08` 修复（改用免鉴权的 `translatetext` 端点），但任译喵落后上游 120 提交、配置 schema 停在 v86（上游 v93），上游补丁**既不能 merge 也不能 cherry-pick**：迁移链、配置字段名（`config.translate` → `config.pageTranslation`）、options 页文件结构全部已经漂移。本次只能按 fork 边界纪律把修复移植进来。

## What Changes

- **微软适配器接管**：把上游修好的适配器复刻到 `src/fork/providers/microsoft-translate.ts`，经 `forkUiRedirectPlugin` 重定向接管上游 `src/utils/host/translate/api/microsoft.ts`。新端点请求体为裸字符串数组，`from`/`to` 是仅有的生效参数。
- **HTML 实体解码内置在 fork 适配器**：新端点常开标签对齐器，输入需 `escapeText`、输出需解码一次。上游把解码规则加在共享的 `translation-output-normalization.ts`，本次改为在 fork 适配器内自行 `decodeHTMLStrict`，共享文件零改动。
- **【破坏性变更】「仅译文」模式不再支持微软翻译**：新端点无保留标记模式，而「仅译文」经 `innerHTML` 重渲染 provider 输出，二者组合必然损坏页面。三个模式写入口全部拦截，微软在网页翻译的 provider 选择器中**置灰**（非隐藏），并说明原因。
- **存量配置运行时归一化**：读到「微软 + 仅译文」组合时按 `bilingual` 处理。**不写上游迁移**——fork 停在 v86 而上游已占用 v87–v99，自建同名迁移必撞车。
- **CI 补 free-api 排除**：`fork-guard.yml` 的 `pnpm run test` 加 `SKIP_FREE_API: true`，与 `pr-test.yml` / `release.yml` 现有做法对齐。
- **不含**：warmup 链删除（`microsoft-warmup.ts` 等 4 个文件，已是死代码）另行立项。

## Capabilities

### New Capabilities

- `microsoft-translate-endpoint`: 微软免鉴权端点适配器的 fork 接管（请求编码、输出解码、重试元数据、html 输入硬失败），以及「微软 × 仅译文」组合的三处写入口拦截、provider 置灰与存量配置归一化。

### Modified Capabilities

- `fork-boundary-guard`: 「三浏览器构建门」中 CI 的 `pnpm run test` 增加 `SKIP_FREE_API: true`，使打真实外部翻译服务的用例在 fork-guard 中跳过。

## Impact

**零上游文件改动**——边界门禁越界数 0。改动全部落在 `src/fork/**`（C 类）、`wxt.config.ts` 与 9 个 locale（allowlist 内的 B 类）、`.github/`（门禁豁免前缀）。

- **重定向清单**：`wxt.config.ts` 的 `FORK_UI_REDIRECTS` 由 8 条增至 11 条（微软适配器、快捷键绑定、options 模式选择器）。
- **受影响 UI 面**：网页翻译的 provider 选择器（`fork/ui/options/feature-provider-selector-list.tsx`，仅 `featureKey === "translate"` 生效）、popup 模式切换按钮、options 模式选择器、模式切换快捷键。划词工具栏 / 语言检测 / 自定义动作 / 字幕 / translation-hub 服务下拉**不受影响**。
- **外部依赖**：请求目标从 `api-edge.cognitive.microsofttranslator.com` 迁至 `edge.microsoft.com/translate/translatetext`，不再需要令牌，凭据处理面减少。
- **fork 长期负债**：fork 永久接管微软适配器，上游后续对该文件的修复不会自动流入；重定向插件的 buildStart 只断言上游路径存在、不比内容，漂移无告警。
- **测试覆盖缺口**：重定向在 vitest 下不生效（`WxtVitest()` 不转发 `wxt.config.ts` 的 vite 插件），上游原版测试会继续绿但测的是休眠代码；fork 副本的逻辑必须在 `src/fork/**/__tests__/` 里自行补测。
- **CI 不再有微软端点实机验证**（pr-test 排除、release 跳过、fork-guard 本次也排除），端点二次下线时自动化侧无人报警，人工验收必须包含微软翻译实机跑通。
