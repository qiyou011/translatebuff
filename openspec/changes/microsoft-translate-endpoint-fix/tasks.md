## 0. 准备与工作区归位

- [x] 0.1 从 `main` 建分支 `fix/MUL-61-microsoft-translate-endpoint`（当前同名分支已存在且含未提交改动，先把 4 个改动文件的内容留存到临时位置）
- [x] 0.2 撤回工作区对上游文件的全部改动：`git checkout -- src/utils/host/translate/api/microsoft.ts src/utils/host/translate/api/__tests__/microsoft.test.ts src/utils/host/translate/translation-output-normalization.ts src/utils/host/translate/__tests__/translation-output-normalization.test.ts`，确认 `git status` 干净
- [x] 0.3 跑基线：`SKIP_FREE_API=true pnpm run test`，记录当前通过数作为后续对比基准

## 1. 微软适配器（fork 接管）

- [x] 1.1 写失败测试 `src/fork/providers/__tests__/microsoft-translate.test.ts`：断言请求打 `edge.microsoft.com/translate/translatetext`、无鉴权头、请求体为裸字符串数组、`from`/`to` 经 `encodeURIComponent`、`fromLang="auto"` 时 `from` 为空串。运行确认**真实红灯**（模块不存在）
- [x] 1.2 创建 `src/fork/providers/microsoft-translate.ts`，实现重载签名与请求编码（`escapeText` 转义输入），跑测试转绿
- [x] 1.3 补测试：`textFormat === "html"` 时抛错且**不发起网络请求**；确认红灯后实现 html 守卫，转绿
- [x] 1.4 补测试：网络异常带 `{ kind: "network", isRetryable: true }`、非 2xx 带 `statusCode` 与 `responseHeaders`；确认红灯后接入 `attachRequestErrorMeta`，转绿
- [x] 1.5 补测试：输出经 `decodeHTMLStrict` 解码**恰好一次**——原文含字面量 `&amp;` 往返后仍为 `&amp;`（既不残留 `&amp;amp;` 也不塌成 `&`）；确认红灯后在返回前加解码，转绿
- [x] 1.6 在 `wxt.config.ts` 的 `FORK_UI_REDIRECTS` 加第 1 条：`src/utils/host/translate/api/microsoft.ts` → `src/fork/providers/microsoft-translate.ts`
- [x] 1.7 跑 `pnpm run build`，确认 buildStart 断言通过、产物构建成功（提交待用户同意，见 6.10）

## 2. 门禁判定与运行时归一化

- [x] 2.1 写失败测试 `src/fork/providers/__tests__/translation-only-gate.test.ts`：`providerSupportsTranslationOnlyMode("microsoft-translate")` 为 false、其他 provider 为 true；`canEnterTranslationOnlyMode` 在 provider 解析不到时返回 true。确认红灯
- [x] 2.2 创建 `src/fork/providers/translation-only-gate.ts`，featureKey 用 `"translate"`（**不是**上游的 `"pageTranslation"`），转绿
- [x] 2.3 写失败测试：`normalizeTranslationMode` 对「微软 + translationOnly」返回 `bilingual`，对「谷歌 + translationOnly」原样返回，且**不写回存储**（断言存储未被调用）。确认红灯
- [x] 2.4 在 `src/fork/providers/` 下实现该纯函数（**不放 `src/fork/config/`**），转绿
- [x] 2.4a **实施期新增**（原设计的「读时纯函数」在 fork 侧无挂载点，纯函数曾无消费方）：写失败测试 `src/fork/background/__tests__/correct-legacy-translation-mode.test.ts`——坏组合纠正并写回、其他组合不写、`getLocalConfig()` 返回 `null` 时安静跳过、读写抛错不冒泡；确认红灯后实现 `src/fork/background/correct-legacy-translation-mode.ts` 并在 `setupFork()` 里 `void` 调用，转绿
- [x] 2.5 写漂移哨兵测试：断言上游 `normalizeTranslationOutput` 对 `microsoft-translate` **仍不解码**，并在测试里注明「此测试失败 = 上游已把微软加进解码集合，需移除 fork 适配器内的解码」
- [x] 2.6 确认 `src/utils/config/migration-scripts/` 无新增、`CONFIG_SCHEMA_VERSION` 仍为 86；提交

## 3. 三个模式写入口拦截

- [x] 3.1 写失败测试 `src/fork/ui/popup/__tests__/translation-mode-selector.test.tsx`：微软 + 双语时点击切换按钮，模式不变、呈禁用外观、tooltip 说明原因；非微软时正常切换。确认红灯
- [x] 3.2 复刻 `src/fork/ui/popup/translation-mode-selector.tsx`（**保持 default 导出**），接入 gate，转绿
- [x] 3.3 改 `src/fork/ui/popup/App.tsx:12` 的 import 指向 fork 副本（**不加 redirect**——唯一 importer 是 fork 自己）；提交
- [x] 3.4 写失败测试 `src/fork/ui/options/__tests__/translation-mode.test.tsx`：微软时选「仅译文」不写入配置并就地说明原因。确认红灯
- [x] 3.5 复刻 `src/fork/ui/options/translation-mode.tsx`，接入 gate。**必须保留具名导出 `TranslationMode` 与 `ConfigCard id="translation-mode"`**（命令面板靠该 id 跳转），转绿
- [x] 3.6 在 `FORK_UI_REDIRECTS` 加第 2 条：`src/entrypoints/options/pages/translation/translation-mode.tsx` → fork 副本；提交
- [x] 3.7 写失败测试 `src/fork/ui/host-content/__tests__/bind-translation-mode-shortcut.test.ts`（**从零写，无可继承测试**——既有 `bind-translation-shortcut.test.ts` 测的是页面翻译开关那个文件）：微软 + 双语时按快捷键，模式不变并弹 toast；非微软时正常切换。确认红灯
- [x] 3.8 复刻 `src/fork/ui/host-content/bind-translation-mode-shortcut.ts`（**保持具名导出 `bindTranslationModeShortcutKey`**），接入 gate + toast，转绿
- [x] 3.9 在 `FORK_UI_REDIRECTS` 加第 3 条：`src/entrypoints/host.content/translation-control/bind-translation-mode-shortcut.ts` → fork 副本。确认 redirect 总数由 8 增至 11；提交

## 4. provider 选择器置灰

- [x] 4.1 写失败测试 `src/fork/ui/options/__tests__/feature-provider-selector-list.test.tsx`：仅译文模式下 `featureKey === "translate"` 行的微软项呈禁用态并说明原因；`featureKey` 为划词/语言检测/自定义动作等其他值时微软**正常可选**；双语模式下全部正常可选。确认红灯
- [x] 4.2 在 `src/fork/ui/options/feature-provider-selector-list.tsx` 接入置灰（该文件第 43/48 行已持有 `featureKey`），转绿
- [x] 4.3 ~~确认两个共享组件未被改动~~ **实际偏差**：`provider-selector-groups.ts` 未动 ✓；`provider-selector.tsx` 新增了一个可选 prop `disabledProviderIds`（纯渲染、不含任何模式判定，判定仍在 `feature-provider-selector-list.tsx`）——`ProviderSelectorOption` 没有 `disabled` 字段，不加这个 prop 无法在不改判定归属的前提下置灰

## 5. 文案与 CI

- [x] 5.1 在 9 个 `src/locales/*.yml` 新增 `microsoftNotSupported` 文案（popup tooltip / options 说明 / 快捷键 toast 共用），避开 `check-fork-brand.mjs` 的禁用 token（`Read Frog` / `陪读蛙` / `陪讀蛙` / `読書カエル` / 小写 b 的 `Translatebuff`）
- [x] 5.2 跑 `node scripts/check-fork-brand.mjs` 确认通过
- [x] 5.3 给 `.github/workflows/fork-guard.yml:22` 的测试步骤加 `env: SKIP_FREE_API: "true"`（**不用 `--exclude` glob**，理由见 design D7）；提交

## 6. 全量验证与交付

- [x] 6.1 边界门禁：`FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs`，**必须输出 `Fork boundary OK`、越界数 0**
- [x] 6.2 `pnpm run type-check`
- [x] 6.3 `SKIP_FREE_API=true pnpm run test`，对比 0.3 的基线，确认无回归
- [x] 6.4 三浏览器构建：`pnpm run build && pnpm run build:edge && pnpm run build:firefox`
- [x] 6.5 `node scripts/assert-fork-build.mjs`
- [x] 6.6 **人工验收（不可用自动测试替代）**：装载构建产物，在真实页面选微软翻译 + 双语模式，确认译文正常出现且无 `&amp;` 类实体残留
- [x] 6.7 **人工验收**：选微软后，分别经 popup 按钮、options 选择器、快捷键三处尝试切「仅译文」，确认都被拦住且都能看懂原因；options provider 列表里网页翻译行的微软呈禁用态，其他功能行不受影响
- [x] 6.8 **人工验收**：把存量配置手工改成「微软 + 仅译文」，重载扩展，确认按双语工作且设置未丢
- [x] 6.9 已把 R1（3 个被影子接管的上游文件 + 每次同步的三步对账）写进 `FORK.md` 新小节「被 fork 影子接管的上游文件」；`/jyopsx-retro` 复盘待用户触发
- [x] 6.10 **经用户明确同意后**提交并推分支，PR 到 `change/fork-foundation`（非 `main`）；交付说明附命令原文与输出、改动文件清单、已知限制（R2/R4/R5）
