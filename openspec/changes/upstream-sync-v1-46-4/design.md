## Context

阶段 1 把 fork 停在上游 v1.43.6。本段从 `53b54d68` 追到 `fe2957c8`（v1.46.4），是三段里唯一同时碰到「上游大重构 + 上游商业化 + 换皮失效」三件事的一段。

阶段 0 之前测得的整体冲突面是 34 个文件，其中 29 个来自本段范围。阶段 0 清掉越界之后，本段的冲突预期收敛到 9 个 locales + `wxt.config.ts`——但这个预期 MUST 在开工前用干跑重新测，不能照搬。

`FORK.md` 已经点明换皮机制的一个根本弱点：`forkUiRedirectPlugin` 的 `buildStart` **只断言路径存在、不比对内容**。上游改了被换皮文件的内容，构建照样绿，没人会知道。本段有 4 条重定向的路径直接失效——这反而是好事，构建会硬失败；真正危险的是那 7 条路径还在、内容却被上游改过的。

## Goals / Non-Goals

**Goals:**

- 追平上游 v1.46.4，拿到 MUL-62 第一档的全部翻译质量修复
- 4 条失效换皮迁移到新路径或下线，7 条存活换皮逐条比对上游内容变更
- 4 块依赖上游后端的功能在 fork 产物里完全不可达，manifest 不含合作方站点权限
- 微软翻译回归上游实现，下线 fork 的整套微软定制

**Non-Goals:**

- 不决定 AI 字幕是否立项（MUL-63），本段只隐藏入口
- 不重建 fork 的 options 页视觉——阶段 0 已把视觉回退到上游，本段跟着上游重构走
- 不接入任何上游商业化能力到任译喵会员体系
- 不新增 fork 功能

## Decisions

### 决策 1：options 重构「跟上游走」，fork 定制作废而非移植

上游删掉的 4 个文件（`config-card.tsx`、`metric-card.tsx`、`auto-translate-languages.tsx`、`skip-languages.tsx`）fork 都改过，构成 4 个 modify/delete 冲突。两条路：把 fork 定制移植进重构后的新结构，或直接作废。

选作废。理由：这 4 处 fork 改动在阶段 0 已被判定为纯视觉（回退档），阶段 0 就已经回退掉了；到本段它们本就不该还有 fork 内容。冲突解法统一 `git rm`，接受上游删除。

### 决策 2：影子功能用「恒定失败的状态钩子」，不用逐组件重定向

Built-in AI 那套的 UI 入口散落在 provider 选择器、options 配额页、popup 提示词选择、字幕面板等至少 5 处。逐个重定向到空组件既繁琐又脆弱（上游一动就断）。

改为掐源头：`src/components/llm-providers/use-hosted-ai-status.ts` 是这套功能的状态源，所有 UI 都读它来决定渲染什么。影子它一个，让它恒定返回「未启用 / 无配额」，上游 UI 自己就不渲染了——这正是 `FORK_GUIDE.md` §4 说的「fork 壳里按需渲染，比逐个重定向更省、更抗冲突」。

`built-in-ai-usage` 配额页与 `ai-quota` 字幕配额页是独立路由入口，状态钩子管不到，这两个另外各换一个空组件。

### 决策 3：`partner-bridge.content` 整块删除，不是换皮

它是 `defineContentScript`，`matches: PARTNER_BRIDGE_ORIGINS.map(o => `${o}/*`)`。换皮成空组件没用——**只要文件还在 `src/entrypoints/` 下，WXT 就会把它的 `matches` 写进 manifest**，站点注入权限照样出现在权限清单里。国内商店审核会问「为什么要往 jalapeno-cloud.ai 注入脚本」，而这个能力对任译喵毫无用处。

处理：`git rm -r src/entrypoints/partner-bridge.content/`，并在 `assert-fork-build.mjs` 加一条 manifest 级断言——产物 manifest 的 `content_scripts` / `host_permissions` 中 MUST NOT 出现 `jalapeno-cloud.ai`。删文件是一次性的，断言是防回归的。

删除动作会出现在同步模式的差集里（fork 相对上游少了一个目录），需在 allowlist 登记。

### 决策 4：微软下线走「先断开、后删除」两步

⚠️ fork 侧微软逻辑有一条**不走重定向**的通路：`src/fork/background/correct-legacy-translation-mode.ts` 由 `src/fork/background/index.ts:14` 的 `setupFork()` 直接调用，用 `getLocalConfig`/`setLocalConfig` 改写上游的 `config.translate.mode`。只删重定向不摘这行接线，它仍会在每次后台启动时把「仅译文」改回双语——那样实测验的是被 fork 篡改过的状态，结论不可信。

所以第一步是「删 3 条重定向 **+ 摘掉 `setupFork()` 里的 `correctLegacyTranslationMode()` 调用**」，两者都是可一行回滚的改动。

fork 侧与微软相关的模块有 6 个：`microsoft-translate.ts`、`translation-only-gate.ts`、`translation-mode-normalization.ts`、`correct-legacy-translation-mode.ts`、`ui/options/translation-mode.tsx`、`ui/host-content/bind-translation-mode-shortcut.ts`，外加 6 个测试文件。

先删 `FORK_UI_REDIRECTS` 里的对应条目，跑一次全绿——此时 fork 模块变成死代码但还在，回滚只需把重定向加回来。确认上游实现在真实页面上工作之后，再删文件。反过来做的话，中途发现上游实现有问题就得从 git 历史里捞回来。

`bind-translation-mode-shortcut.ts` 与 `translation-mode.tsx` 两条换皮的存在理由是「微软激活时拦住仅译文模式」，微软下线后理由消失，一并删除。注意 `FORK.md` 特别标注过：`translation-mode.tsx` 必须保留具名导出 `TranslationMode` 与 `ConfigCard id="translation-mode"`，命令面板靠该 id 跳转——删除这条换皮后该约束自然解除，但要确认上游重构后的新组件仍被命令面板正确索引。

### 决策 5：路径 + 指纹双断言，人工 diff 为辅

阶段 0 已给每条重定向加了内容指纹（`src/fork/identity/redirect-baseline.json`），`buildStart` 现在是**路径存在 + 内容指纹**双断言，上游改了被换皮文件的内容会直接构建失败，不再是「构建绿但皮悄悄掉」。

指纹失配是本段的常态而非意外——对**当时 `FORK_UI_REDIRECTS` 的全部条目**（阶段 0 之后条数已变，不再是 11 条），逐条跑：

```bash
git diff 53b54d68..fe2957c8 -- <每条重定向的 from 路径>
```

有 diff 的，判断上游改动要不要搬进 fork 副本，判断结论逐条写进 PR，**确认后才更新指纹**——直接刷新指纹了事就等于把这套机制关掉。`FORK.md` 已经把其中三条列为「上游会继续演进、漏看会出功能问题」的高危项，本段范围内微软那条要删除，另外两条（`bind-translation-mode-shortcut.ts`、`translation-mode.tsx`）也要删除——高危表在本段之后会清空，需同步更新 `FORK.md`。

### 决策 6：`config.translate` → `config.pageTranslation` 改名要专门确认

`FORK.md` 警告过：若同步到上游把 `config.translate` 改名为 `config.pageTranslation` 的那一版，`src/fork/providers/translation-only-gate.ts` 的 featureKey 与三个 fork 副本读的字段要一起改。本段范围覆盖了上游多次配置结构调整，开工第一步就要确认这次改名是否落在 `53b54d68..fe2957c8` 区间内——落在区间内且相关 fork 模块尚未删除时，必须先改字段再谈其他。

### 决策 7：fork 测试用阶段 0 引入的 `vitest.fork.config.ts`

影子功能的测试要断言「上游 UI 在影子状态下不渲染」，这需要重定向在测试环境生效。根 `vitest.config.ts` 不加载 `wxt.config.ts` 的 `vite()` 钩子，`FORK.md` 已点明这个弱点。

阶段 0 已建好 `vitest.fork.config.ts`（`mergeConfig` 根配置后追加 `forkUiRedirectPlugin`），本段直接用：`pnpm vitest run --config vitest.fork.config.ts src/fork`。**根 `vitest.config.ts` 仍然一个字不改**——全局注册会让上游自己的测试也解析到 fork 影子，而影子恒返回「未启用」，上游断言必然落空、`pnpm run test` 判红，修它只能改上游测试文件、又成越界。

### 决策 8：AI 字幕的真实入口在字幕面板，不只是配额页

只换掉 `options/pages/video-subtitles/ai-quota/index.tsx` 不够。上游的实际触发点是：

- `src/entrypoints/subtitles.content/ui/subtitles-settings-panel/components/request-ai-subtitles-item.tsx`（挂在同目录 `views/main-menu.tsx`）
- `src/entrypoints/subtitles.content/universal-adapter.ts` 的自动路径

点击后走 `src/utils/subtitles/ai/access-guard.ts` 的 `ensureAiSubtitlesEntitled()`，未订阅直接弹 `aiSubscriptionRequired` toast 加升级引导——正是风险 2 要避免的「用户点到 read-frog 付费墙」。两处都要处理。

## Risks / Trade-offs

**风险 1：影子掉皮。** 阶段 0 的内容指纹已经把「上游改了内容而 fork 副本没跟」变成硬失败，但指纹只保证「有人看过」，不保证「看对了」。缓解：逐条 diff 与判断结论入 PR 是硬性任务；并用 `vitest.fork.config.ts` 在 `src/fork/**/__tests__/` 补 fork 副本的集成断言——根 `vitest.config.ts` 不加载重定向，上游原版测试测的是休眠代码，指望不上。

**风险 2：影子功能漏网，用户点到 read-frog 的付费墙。** 4 块功能的 UI 入口分布在至少 12 个文件里，靠人工枚举必然有遗漏。

初稿曾提出「产物中搜索 `jalapeno` / `atlascloud` / `readfrog.s.gy` / `videoTranscript` 四个关键串，命中即失败」。**该方案不可满足**：这四个串的真源全在 A 类 take-theirs 文件里——`src/utils/constants/providers.ts` 定义两个 provider id 与 `apiKeyUrl`，`src/types/config/provider/{constants,schemas}.ts` 与 `v095-to-v096`/`v097-to-v098`/`v098-to-v099` 三个迁移脚本同样带这两个 id，`videoTranscript` 在 `src/utils/subtitles/ai/**`（D 类引擎）与 orpc 契约里。要让这条门禁变绿只能改 A 类文件，等于违反不变量「A 类一律 take-theirs」；不改就是永久红灯。

缓解改为两条可满足的断言：

1. **manifest 级**：产物 manifest 的 `content_scripts` / `host_permissions` 无 `jalapeno-cloud.ai`。这条成立，因为删掉 entrypoint 后 manifest 里本就不该有。
2. **fork 侧枚举测试**：以上游 `PROVIDER_ITEMS` 的全部 key 为输入，断言 fork 展示层的输出不含 `jalapenocloud` / `atlascloud`，并且**任何未被 fork 显式分类的新 provider id 都让测试失败**。后者才是真正的防漏网机制——上游下次再加一个合作方 provider，测试立刻红，而不是等到用户点到才发现。

**风险 3：11 个配置迁移串行跑，中途某一步把 fork 字段冲掉。** 上游迁移脚本是按上游 schema 写的，不认识 fork 的独立 storage key，理论上互不干扰；但 `v092-to-v093` 会改写 `providersConfig` 里的微软条目，而 fork 的任译喵实例也住在 `providersConfig` 里。缓解：拿真实存量配置跑一次 88→99 全链迁移，逐条比对任译喵实例集与各功能 `providerId` 指向。

**风险 4：微软换回上游后实际不可用。** 上游实现基于 2026-08 的端点行为，任译喵的用户网络环境（国内）可能与之不同。缓解：决策 4 的两步走保证回滚成本低；人工冒烟必须在国内网络下实测微软翻译，而不是只跑单测。

**回滚策略**：整段落在 `feat/upstream-sync-v1-46-4` 分支，合入前随时丢弃。

合入后的回滚方式是**把 `change/fork-foundation` 重置到合并前的提交**，MUST NOT `git revert` 掉 merge commit——revert 后上游提交在分支上仍算已合并，下次 merge 不会带回内容，必须先 revert-the-revert，等于在「只 merge」不变量上开静默的洞。

更重要的是：上游 `v092-to-v093` 把「微软 + 仅译文」存量配置改指 Google 是**单向数据迁移**，代码回滚回滚不了它。真正无副作用的回滚窗口只在内测包发出之前；决策 4 的两步走就是把这个窗口尽量拉长。

## Open Questions

无。落脚点已拍板固定在 `fe2957c8`：开工时若上游已发新版，本段**不追新**，另立阶段 3 处理增量。追新会让本文档的全部冲突分析、换皮迁移清单与影子功能清单重新失效。
