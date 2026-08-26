# 阶段 2：同步上游至 v1.46.4

目标提交：`fe2957c8`（v1.46.4）
工作分支：`feat/upstream-sync-v1-46-4`，从 `change/fork-foundation` 切出，以 PR 合回 `change/fork-foundation`。
上次同步落脚点：`53b54d68`（v1.43.6），下称 `$PREV`。

> **备忘：提示词实验被移除（2026-08-25，用户确认「后续可能恢复」）**
>
> 上游 #2036（`dc1c3fca feat(translation): add precision rewrite as an optional built-in prompt`）
> 把整套提示词 A/B 实验撤了：`trackTranslationRequested` / `classifyTranslationRequest` /
> `TRANSLATION_REQUESTED_FEATURE` / `TranslationActionContext` 类型、以及
> `exposePromptExperiment` 与 `clearPromptExperimentAction` 两条消息全部不复存在。
>
> fork 侧 `src/fork/ui/selection-content/use-selection-translation-controller.ts` 曾消费这套接口，
> 随之移除。**要恢复的话**：该文件在本次同步前的版本可从 `git show 4a85f62a:<path>` 取回，
> 里面完整保留了 `actionContext` 构造、`trackTranslationRequested` 上报、
> `exposePromptExperiment` 分流与 `finally` 里的 `clearPromptExperimentAction` 清理。
> 但接口是上游撤的，恢复意味着 fork 要自建这套事件与消息通道——属独立需求，不在本次同步范围内。

## 0. 前置门禁

- [ ] 0.1 确认 `upstream-sync-v1-43-6` 已合入 `change/fork-foundation`，且内测包人工验收通过
- [ ] 0.2 确认上游 `config.translate` → `config.pageTranslation` 改名是否落在 `$PREV..fe2957c8` 区间：`git log $PREV..fe2957c8 --oneline -S"pageTranslation"`。落在区间内则先处理字段改名，再做其他
- [ ] 0.3 确认 `src/fork/identity/upstream-baseline.json` 的 `lastSyncedSha` 已被阶段 1 更新为 `53b54d68`——没更新则同步模式与本节前置门禁都会用错基准
- [ ] 0.4 重跑干跑 `git merge-tree --write-tree --name-only change/fork-foundation fe2957c8`，冲突清单贴进 PR 草稿。预期只剩 9 个 locales + `wxt.config.ts`；出现 `.tsx` 冲突说明阶段 0 有遗漏，先回去补
- [ ] 0.5 对**当时 `FORK_UI_REDIRECTS` 的全部条目**（阶段 0 之后条数已变，不再是 11 条）逐条打印上游 diff：`git diff $PREV..fe2957c8 -- <from路径>`，把每条的判断结论（有无变化 / 是否需搬入 fork 副本）列成表贴进 PR 草稿

## 1. 合并

- [ ] 1.1 `git switch -c feat/upstream-sync-v1-46-4 change/fork-foundation && git merge fe2957c8`
- [ ] 1.2 9 个 locales 冲突机械解：保留 fork 品牌串，其余接受上游
- [ ] 1.3 `wxt.config.ts` 手工解，fork 的版本注入 / `gecko.id` / `artifactTemplate` / 渠道号 / `FORK_UI_REDIRECTS` 逐项确认保留
- [ ] 1.4 modify/delete 冲突统一接受上游删除：`git rm src/entrypoints/options/components/config-card.tsx src/entrypoints/options/components/metric-card.tsx`。另外两个（`auto-translate-languages.tsx`、`skip-languages.tsx`）已在阶段 0 清除档删掉，此处**若仍存在**才 `git rm`，否则跳过
- [ ] 1.5 `pnpm install` 重生成 lockfile
- [ ] 1.6 提交合并结果。⚠️ 此时构建**预期是红的**：4 条换皮路径失效 + 多条内容指纹失配，`buildStart` 会全部报出来。这是设计行为，走第 2 节处理

## 2. 换皮重定向迁移

- [ ] 2.1 `translation-mode.tsx` 那条：本段要整体删除（见第 4 节），此处先不迁
- [ ] 2.2 `providers-config.tsx` → `providers-config/index.tsx`，改 `FORK_UI_REDIRECTS` 的 `from`
- [ ] 2.3 `selection-toolbar-save-suggestion-toggle.tsx`：上游已删除该开关（`saveSuggestion` 在 v1.46.4 仅存于迁移测试夹具），删掉这条重定向与 `src/fork/ui/selection-toolbar/save-suggestion-toggle.tsx`
- [ ] 2.4 `options/pages/config/google-drive-sync/index.tsx` → `options/pages/preference/config/google-drive-sync/index.tsx`，改 `from`
- [ ] 2.5 按 0.5 的对账表，把需要搬入的上游改动逐条搬进对应 fork 副本，并在 `src/fork/**/__tests__/` 补测（根 `vitest.config.ts` 不加载重定向，上游原版测试测的是休眠代码，指望不上；fork 测试用 3.0 引入的 `vitest.fork.config.ts`）
- [ ] 2.6 **确认对账完成后**才更新 `src/fork/identity/redirect-baseline.json` 里失配条目的指纹。直接刷新指纹了事就等于把这套机制关掉——`microsoft.ts` 是 `FORK.md` 点名的最高危项，尤其不能跳
- [ ] 2.7 `pnpm run build` 通过——`buildStart` 不再报失效路径或指纹失配
- [ ] 2.8 提交

## 3. 影子功能：4 块全部隐藏

- [ ] 3.1 确认阶段 0 引入的 `vitest.fork.config.ts` 可用：`pnpm vitest run --config vitest.fork.config.ts src/fork` 能跑通。本节所有「先红后绿」都依赖它——根 `vitest.config.ts` 不加载重定向，接重定向不会让测试转绿
- [ ] 3.2 **Built-in AI**：新建 `src/fork/ui/hosted-ai/use-hosted-ai-status.ts`，恒定返回未启用 / 无配额；加重定向指向上游 `src/components/llm-providers/use-hosted-ai-status.ts`
- [ ] 3.3 先写测试（放 `src/fork/**/__tests__/`，用 `pnpm vitest run --config vitest.fork.config.ts` 跑）：popup provider 选择器、选项页功能提供商列表在该状态下不渲染任何分层 / 配额 / Ultra 徽标；跑红后再接重定向，跑绿
- [ ] 3.4 独立路由/菜单入口逐个换 fork 空组件：`options/pages/api-providers/built-in-ai-usage/index.tsx`、`options/pages/video-subtitles/ai-quota/index.tsx`、**`src/entrypoints/subtitles.content/ui/subtitles-settings-panel/components/request-ai-subtitles-item.tsx`**（字幕面板主菜单里的「请求 AI 字幕」，才是用户点得到的真实入口，点下去走 `ensureAiSubtitlesEntitled()` 弹上游订阅引导）
- [ ] 3.5 确认 `src/entrypoints/subtitles.content/universal-adapter.ts` 的自动 AI 字幕路径不会绕开 UI 直接触发；会则一并挡掉
- [ ] 3.6 **Jalapeno / Atlas**：`git rm -r src/entrypoints/partner-bridge.content/`（并在 allowlist 登记该删除）；在 fork 的 provider 展示层过滤掉 `jalapenocloud` / `atlascloud` 两项与「Get API key」按钮
- [ ] 3.7 **白名单式枚举测试**：以上游 `PROVIDER_ITEMS` 全部 key 为输入，断言 fork 展示层输出不含这两个 id，且**任何未被显式分类的 provider id 都让测试失败**。这是防漏网的主机制——上游下次再加合作方 provider，测试立刻红
- [ ] 3.8 **plan-badge**：`src/components/badges/plan-badge.tsx` 换皮到 fork 版——读 `src/fork/membership/tier.ts`，无任译喵会员态时不渲染。
- [ ] 3.9 **横切一条 · 逐个确认**：给本节建的**全部**影子模块各自加 `satisfies typeof import("<对应上游模块>")` 约束导出签名——`src/fork/ui/hosted-ai/use-hosted-ai-status.ts`（3.2）、3.4 的三个空组件（`built-in-ai-usage`、`ai-quota`、`request-ai-subtitles-item`）、3.8 的 plan-badge fork 版。枚举测试（3.7）只覆盖 provider 维度，plan-badge / hosted-AI / 字幕入口靠这条在编译期兜；**逐个过一遍，不要只在其中一个上做了就打勾**。验收出口是 6.x 的 `pnpm run type-check`
- [ ] 3.10 在 `scripts/assert-fork-build.mjs` 加 **manifest 级**断言：产物 manifest 的 `content_scripts` 与 `host_permissions` 无 `jalapeno-cloud.ai`。**不要加「产物中不得出现关键串」的断言**——`jalapenocloud`/`atlascloud`/`readfrog.s.gy` 的真源在 `src/utils/constants/providers.ts`、`src/types/config/provider/**` 与三个迁移脚本（全是 A 类 take-theirs），`videoTranscript` 在 D 类引擎里，那条断言只有改 A 类才能变绿
- [ ] 3.11 跑 `pnpm run build && node scripts/assert-fork-build.mjs` 通过
- [ ] 3.12 提交

## 4. 微软翻译换回上游（两步走，可回滚）

- [ ] 4.1 **第一步（两个动作缺一不可）**：(a) 从 `FORK_UI_REDIRECTS` 删掉 3 条——`microsoft.ts`、`translation-mode.tsx`、`bind-translation-mode-shortcut.ts`；(b) **摘掉 `src/fork/background/index.ts:14` 的 `correctLegacyTranslationMode()` 调用**。这条通路不走重定向、由 `setupFork()` 直接调用，只删重定向的话它仍会在每次后台启动时改写 `config.translate.mode`，4.3 实测验到的就是被 fork 篡改过的状态。两个动作都是一行改动，回滚加回即可
- [ ] 4.2 `pnpm run test` 与三浏览器构建全绿
- [ ] 4.3 打测试包，**在国内网络下**实测微软翻译：双语模式译一篇真实网页
- [ ] 4.4 确认上游 `v092-to-v093` 迁移生效：造一份「已选微软 + 仅译文」的存量配置，跑迁移后 provider 应指向 Google 翻译
- [ ] 4.5 确认上游重构后的翻译模式组件仍被命令面板正确索引（原 `ConfigCard id="translation-mode"` 的跳转能力）
- [ ] 4.6 **第二步**（4.3–4.5 全部通过后）：删除 `src/fork/providers/microsoft-translate.ts`、`translation-only-gate.ts`、`translation-mode-normalization.ts`、`src/fork/background/correct-legacy-translation-mode.ts`、`src/fork/ui/options/translation-mode.tsx`、`src/fork/ui/host-content/bind-translation-mode-shortcut.ts` 及其 6 个测试文件
- [ ] 4.7 删掉 `correct-legacy-translation-mode.ts` 文件本身（接线已在 4.1 摘除）
- [ ] 4.8 提交

> ⚠️ 上游 `v092-to-v093` 把「微软 + 仅译文」存量配置改指 Google 是**单向数据迁移**，代码回滚回滚不了它。无副作用的回滚窗口只到内测包发出为止。

## 5. 配置迁移验证（88 → 99，11 个脚本）

- [ ] 5.1 确认 `CONFIG_SCHEMA_VERSION` 为 99，11 个迁移脚本全部合入
- [ ] 5.2 拿真实存量配置跑 88→99 全链迁移，逐条比对：任译喵实例集条目数、各功能 `providerId` 指向、fork 侧 `membership` 字段
- [ ] 5.3 重点验 `v092-to-v093`——它会改写 `providersConfig` 里的微软条目，而任译喵实例也住在 `providersConfig` 里，确认互不误伤
- [ ] 5.4 前后对比贴进 PR

## 6. 全绿门禁

- [ ] 6.1 `pnpm vitest run src/fork/providers/__tests__/upstream-decode-drift.test.ts`（哨兵，最先跑）
- [ ] 6.2 `pnpm vitest run --config vitest.fork.config.ts src/fork`
- [ ] 6.3 `pnpm run test`
- [ ] 6.4 `pnpm run type-check`——这是 3.9 那条 `satisfies` 约束的验收出口，缺了约束的影子模块在此暴露
- [ ] 6.5 `pnpm run build && pnpm run build:edge && pnpm run build:firefox`
- [ ] 6.6 `node scripts/assert-fork-build.mjs`（含 3.10 新增的 manifest 级站点断言；provider 白名单枚举测试在 3.7，跑在 vitest 里，由 6.2/6.3 覆盖）
- [ ] 6.7 `FORK_SYNC_MODE=1 node scripts/check-fork-boundary.mjs`——**同步分支必须走同步模式**；此时 HEAD 已不是合并提交，脚本推导不出基准会硬失败（设计如此），显式补 `FORK_SYNC_BASE=fe2957c8`。用增量模式会把 800 个上游文件全判越界。本段新增的 allowlist 登记项：`partner-bridge.content` 删除（3.6）、被上游重构删掉的 options 文件（1.4）。`vitest.fork.config.ts` 由阶段 0 引入、走 `FORK_ROOT_FILES`，不占 allowlist
- [ ] 6.8 `node scripts/check-fork-brand.mjs`——本段上游新增大量文案，"Read Frog" 残留会在此被揪出
- [ ] 6.9 人工比对产物 manifest 的 `name` / `version` / `version_name` / `gecko.id` / `content_scripts`
- [ ] 6.10 diff `@read-frog/api-contract` `0.12.0`→`0.14.0` 与 `definitions` `0.4.0`→`0.4.4` 的四项契约常量，结论贴进 PR
- [ ] 6.11 提交

## 7. 人工冒烟

- [ ] 7.1 `node scripts/pack.mjs test` 打包装载
- [ ] 7.2 翻译引擎修复抽验：paulgraham.com 长文全文译出（#2109）、含 `notranslate` 的页面正常翻译（#2085）、长页滚动不卡（#2052）、含高浮动元素的页面译文位置正确（#2047）
- [ ] 7.3 微软翻译在国内网络下可用（复验 4.3）
- [ ] 7.4 逐项确认 4 块影子功能不可达：provider 选择器无 Jalapeno/Atlas、无 Built-in AI 分层、账号菜单无套餐徽标、**字幕面板主菜单无「请求 AI 字幕」项、选项页无分钟配额**
- [ ] 7.5 options 页各 section 与 drill-in 可达，任译喵 API 块的连接检测与更新模型可用
- [ ] 7.6 登录与会员态读取正常
- [ ] 7.7 冒烟结果逐条记进 PR

## 8. 收尾

- [ ] 8.1 更新 `FORK.md` 的「被 fork 影子接管的上游文件」对账表——微软那三条已删除，表内容需重写
- [ ] 8.2 更新 `src/fork/identity/upstream-baseline.json`：`lastSyncedSha` = `fe2957c8`、`lastSyncedVersion` = `1.46.4`；`FORK.md` 同步记录，供下次 diff 用
- [ ] 8.3 `src/fork/identity/fork-version.json` 版本号递增，`version_name` 溯源更新为 `rf 1.46.4`
- [ ] 8.4 提 PR 到 `change/fork-foundation`，等人工审核
