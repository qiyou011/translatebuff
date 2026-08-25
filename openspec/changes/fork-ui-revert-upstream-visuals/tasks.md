# 阶段 0「还债」实施清单

分叉点 SHA：`e15e5b68ee95f5f0f99368252e5d0a24fb14ca32`（下称 `$FORK_POINT`）
工作分支：`fix/fork-ui-revert-upstream-visuals`，从 `change/fork-foundation` 切出，以 PR 合回 `change/fork-foundation`。

> ⚠️ 本文的「回退档 / 搬迁档 / 清除档 / 资源档」与 `FORK.md` 的 A/B/C/D 类**无对应关系**，语义甚至相反（FORK.md 的 B 类 = 允许原地改，本文搬迁档 = 禁止原地改）。刻意不用字母命名以免误读。

每档收尾统一验收：

```bash
pnpm run test
pnpm run build && pnpm run build:edge && pnpm run build:firefox
node scripts/assert-fork-build.mjs
FORK_DIFF_BASE=origin/change/fork-foundation node scripts/check-fork-boundary.mjs   # 门禁（增量模式）
FORK_SCAN_ALL=1 node scripts/check-fork-boundary.mjs                                # 排查用，不判成败
pnpm vitest run --config vitest.fork.config.ts src/fork                             # fork 侧测试（重定向生效）
```

## 1. 基建：护栏的触发面与模式

`scripts/fork-allowlist.json` **不加任何前缀字段**。109/110 的越界能进来，是因为 `fork-guard.yml` 只在 `on: pull_request: branches: [main]` 触发，而团队约定是 `feat/*`、`fix/*` 提 PR 到 `change/fork-foundation`——护栏在每一次日常 PR 上都不运行。

- [x] 1.1 新建机读基线真源 `src/fork/identity/upstream-baseline.json`：`{ forkPointSha, lastSyncedSha, lastSyncedVersion }`，三项初值都是分叉点 / `1.42.2`。它只服务 `FORK_SCAN_ALL` 与 `FORK.md` 对账，**不参与同步模式基准推导**
- [x] 1.2 先写失败测试 `scripts/__tests__/check-fork-boundary.test.ts`，四条：(a) 同步模式下纯上游文件 MUST NOT 判越界；(b) 增量模式下同一文件出现在 PR diff 里 MUST 判越界；(c) **HEAD 不是合并提交、且未给 `FORK_SYNC_BASE` 时，同步模式 MUST 报错退出**；(d) **推导或给定的基准若等于 base 分支 tip，MUST 判无效并硬失败**
- [x] 1.3 跑测试确认红灯（当前脚本只有单一基准，无模式概念）
- [x] 1.4 在 `check-fork-boundary.mjs` 实现两种模式。同步模式的基准**推导 + 校验**，注意三个坑：CI 里 `actions/checkout` 检出的是合成 merge ref，`git rev-parse HEAD^2` 拿到的是 PR 分支 tip（差集近乎为空、**空转恒绿**，比全判红更难发现）；本地跑到门禁那步 HEAD 早已不是合并提交；中途 `git merge change/fork-foundation` 跟一次 base 会污染第二父。- 推导：取本分支上最近一个「第二父不是 base 分支祖先」的 merge 提交的第二父；或由命令行 `FORK_SYNC_BASE=<sha>` 显式给定 - 校验（两条路径都必须过）：`git merge-base --is-ancestor $BASE HEAD` 成立，且 `git merge-base --is-ancestor $BASE origin/$BASE_REF` 不成立 - **推导失败或校验不过一律硬失败退出，绝不回落增量模式** - `FORK_SCAN_ALL=1` 从 `upstream-baseline.json` 读 `forkPointSha`；脚本与工作流里不得出现硬编码 SHA
- [x] 1.5 跑绿 1.2 的四条测试
- [x] 1.6 `.github/workflows/fork-guard.yml`：去掉 `on.pull_request.branches: [main]`；checkout 加 `ref: ${{ github.event.pull_request.head.sha }}`（保留 `fetch-depth: 0`），让 HEAD 就是分支 tip、不必从合成 merge 绕一层；按分支名分流，`feat/upstream-sync-*` 走 `FORK_SYNC_MODE=1`，其余走增量模式
- [x] 1.7 新建 `vitest.fork.config.ts`（决策 10）：`mergeConfig` 根配置后追加 `forkUiRedirectPlugin(FORK_UI_REDIRECTS)`，并补进脚本的 `FORK_ROOT_FILES`。**根 `vitest.config.ts` 一个字不改、不进 allowlist**——全局注册会让上游自己的测试也解析到 fork 影子（`providers-config.test.tsx`、`feature-provider-selector-list.test.tsx`、`beta-gating.test.tsx`、`translate-text.test.tsx`），上游断言必然落空、`pnpm run test` 判红，修它只能改上游测试文件、又成越界。第 4 节所有「先红后绿」都依赖这一步
- [ ] 1.8 用一个只改 `src/utils/message.ts` 一行的临时分支提 PR 到 `change/fork-foundation`，确认 `fork-guard` 这次真被触发且判红；验完关 PR、删分支
- [ ] 1.9 ⏸ **由用户自行配置（2026-08-25：你不管）** · 人工检查点：在 GitHub 给 `main` 与 `change/*` 开分支保护（要求 PR 合入 + `fork-guard` 为必需检查），以 `gh api repos/qiyou011/translatebuff/branches/main/protection` 的输出为证贴进 PR。扩大触发面只覆盖「走 PR」的路径，直接本地 merge 这条路只有分支保护能堵——这是 109 个越界的真实来路，不闭环等于核心目标没达成
- [x] 1.10 提交（`4235b0d6`）

## 2. 资源档：fork 身份资源（32 个）

- [x] 2.1 3 个 fork 净新增迁进 fork 领地：`src/assets/icons/renyimiao.svg` → `src/fork/assets/renyimiao.svg`；`assets/renyimiao-icon.svg` → `src/fork/assets/renyimiao-icon.svg`；`.gitattributes` 补进脚本的 `FORK_ROOT_FILES` 集合
- [x] 2.2 全仓更新这两个 svg 的 import 路径，`pnpm run build` 确认资源仍进产物
- [x] 2.3 把以下 29 个上游素材/配置替换**逐条**追加进 `scripts/fork-allowlist.json` 的 `files` 数组（不用前缀）。同步模式的差集正是「fork 相对上游的自有改动」，这些必然出现在里面，不登记就判红：

```
.env.example
assets/2025-recap.png
assets/banner-zh.png
assets/banner.png
assets/opengraph.svg
assets/read-frog-original.png
assets/star.png
assets/store/1.png
assets/store/2.png
assets/store/3.png
assets/store/4.png
assets/store/Marquee promo tile.png
assets/store/Small promp tile.png
assets/translate.png
assets/wechat-account.jpg
package.json
public/icon/128.png
public/icon/16-active.png
public/icon/16.png
public/icon/32-active.png
public/icon/32.png
public/icon/48-active.png
public/icon/48.png
public/icon/96.png
src/assets/demo/context-menu.png
src/assets/demo/floating-button.png
src/assets/demo/selection-toolbar.png
src/assets/icons/read-frog.png
src/assets/providers/read-frog-provider.png
```

- [x] 2.4 `FORK_SCAN_ALL=1 node scripts/check-fork-boundary.mjs` 确认这 29 条不再出现在 violations 里
- [x] 2.5 提交

> 📌 **实施偏离（2026-08-25）**：`assets/renyimiao-icon.svg` 未迁入 `src/fork/assets/`。它只被 9 个 README 引用、无任何代码 import，属文档素材而非代码；迁走要改 9 处 markdown 链接并把 README 配图放进 `src/`，反而更别扭。改为与其余 29 条一样逐条登记进 allowlist。

## 3. 清除档：丢弃与 take-theirs（8 个）

> ⏸ **`.changeset/` 下 5 个 fork 自造的 changeset 本阶段不删**（用户 2026-08-25 决定：暂不，所有阶段完成后再说）。它们会继续出现在同步模式的差集里，需在 allowlist 登记为已知存量；待阶段 2 完成后再统一处理。

> 📌 **施工修正**：原清单里的 `auto-translate-languages.tsx`、`skip-languages.tsx` **不在本节删除**。「上游已删」是阶段 2 合并后的事实，阶段 0 尚未 merge，两者仍被 `options/pages/translation/index.tsx` import，删掉即构建失败。已改归第 5 节回退档（取分叉点版本），阶段 2 才作为 modify/delete 冲突 `git rm`。

- [x] 3.1 `src/utils/config/migration.ts` 取分叉点版本（上游已有等价的 `buildMigrationRegistry`，阶段 2 合并时自然带入）。清单里的 5 个 `.changeset/*.md` **跳过不删**（用户决定暂缓），改为登记进 allowlist：

```
.changeset/bright-birds-emphasize-translate.md
.changeset/calm-cats-refine-ui.md
.changeset/fresh-cats-rebrand-ui.md
.changeset/kind-tools-showcase.md
.changeset/quick-cats-open-popup.md
src/utils/config/migration.ts
```

- [x] 3.2 `pnpm run test` 确认无测试引用被删文件
- [x] 3.3 把 5 个 `.changeset/*.md` 追加进 `scripts/fork-allowlist.json` 的 `files`（暂缓删除期间的已知存量）
- [x] 3.4 存量扫描的**源码级条目**降到 72 = 回退档 43 + 搬迁档 29（资源档 30 条与 5 个 changeset 已登记、不再计入）；提交

## 4. 搬迁档：功能性改动搬进 src/fork（29 个）

**每个文件三步走，逐文件独立完成、独立验证：**

1. `git diff $FORK_POINT change/fork-foundation -- <file>` 打印 fork 改动，逐条确认哪些行为必须保留
2. 在 `src/fork/` 下建模块承载该行为，写 fork 侧测试并用 `pnpm vitest run --config vitest.fork.config.ts src/fork` 跑（先红后绿）
3. `git checkout $FORK_POINT -- <file>` 回退上游文件；若消费方是上游文件则加换皮重定向，断言 `git diff $FORK_POINT -- <file>` 为空

**重定向判据（决策 8）**：只有 importer 在上游侧、fork 改不到其 import 语句时才加重定向。消费方本来就是 fork 模块的（如 `blog-notification` 由 `src/fork/ui/popup/App.tsx` 直接 import），搬进 fork 后改 import 即可，不占重定向名额。

待搬迁清单：

```
src/components/api-config-warning.tsx
src/components/brand-mark.tsx
src/components/help-button.tsx
src/components/user-account-menu/shared.tsx
src/entrypoints/options/app-sidebar/__tests__/whats-new-footer.test.tsx
src/entrypoints/options/components/overlay-feature-preview.tsx
src/entrypoints/options/pages/context-menu/index.tsx
src/entrypoints/options/pages/floating-button/index.tsx
src/entrypoints/options/pages/selection-toolbar/index.tsx
src/entrypoints/options/pages/translation/auto-translate-languages.tsx
src/entrypoints/options/pages/translation/skip-languages.tsx
src/entrypoints/popup/atoms/auto-translate.ts
src/entrypoints/popup/components/__tests__/blog-notification.test.tsx
src/entrypoints/popup/components/blog-notification.tsx
src/entrypoints/popup/components/discord-button.tsx
src/entrypoints/popup/components/more-menu.tsx
src/entrypoints/popup/components/providers-field.tsx
src/entrypoints/popup/main.tsx
src/entrypoints/selection.content/selection-toolbar/custom-action-button/__tests__/save-to-notebase-button.test.tsx
src/entrypoints/side.content/components/floating-button/__tests__/index.test.tsx
src/entrypoints/side.content/components/floating-button/index.tsx
src/entrypoints/side.content/index.tsx
src/entrypoints/sidepanel/main.tsx
src/entrypoints/subtitles.content/ui/subtitles-translate-button.tsx
src/utils/__tests__/notebase-pending-save.test.ts
src/utils/config/__tests__/migration-scripts/v085-to-v086.test.ts
src/utils/config/migration-scripts/v085-to-v086.ts
src/utils/notebase/pending-save.ts
src/utils/providers/provider-display.ts
src/utils/providers/provider-registry.ts
src/utils/utils.ts
```

- [x] 4.1 品牌接线组：`brand-mark.tsx`、`api-config-warning.tsx`、`help-button.tsx`、`user-account-menu/shared.tsx` → `src/fork/components/`，链接统一走 `getWebsiteUrl`
- [x] 4.2 **spike 已完成（2026-08-25，结论：可行）**：`ui-redirect-plugin` 的 `resolveId` 在 `!importer` 时 return null，而 `main.tsx` 是 HTML 入口模块，原本不确定能否命中。实测把 `popup/main.tsx` 临时重定向到一个带独有标记的探针文件，构建后标记出现在 `.output/chrome-mv3/chunks/popup-*.js` —— **重定向能命中 HTML 入口模块**（`index.html` 里的 `<script type="module" src="./main.tsx">` 走的是带 importer 的解析路径）。故 `popup/main.tsx`、`sidepanel/main.tsx` 按常规换皮处理，**不需要**退回「缩成 2 行壳 + 进 allowlist」的备选方案
- [x] 4.3 popup 组：`blog-notification.tsx`(+test)、`more-menu.tsx`、`discord-button.tsx`、`providers-field.tsx`、`atoms/auto-translate.ts` → `src/fork/ui/popup/`；`main.tsx` 按 4.2 的结论处理
- [x] 4.4 **实测推翻**：那处去重改在了 `src/entrypoints/popup/components/providers-field.tsx`，而 fork popup 渲染的是 `src/fork/ui/popup/providers-field.tsx`（仍是上游 `providerKeyCounts` 写法）——修改从未生效，是死代码。上游文件直接回退。若确实想要「同一 provider 只显示一次」，应改 fork 那一份，属独立需求
- [x] 4.5 sidepanel 与 side.content 组：`sidepanel/main.tsx`（同 4.2 结论）、`side.content/index.tsx`（shadow host `-overlay` 后缀）、`side.content/components/floating-button/index.tsx`(+test)
- [x] 4.6 options 组：`overlay-feature-preview.tsx`(159 行) → `src/fork/ui/options/`；`context-menu`/`floating-button`/`selection-toolbar` 三个 index.tsx 回退到上游 demo 图版本；`app-sidebar/whats-new-footer` 测试回退
- [x] 4.7 provider 展示层：`provider-display.ts` → `src/fork/providers/` + 重定向。**`provider-registry.ts` 直接回退不做换皮**——它的改动只是把 `BUILT_IN_AI_PROVIDER_LOGO` 换成任译喵图标，而 fork 选择器是白名单式分组（只放任译喵实例 + 纯翻译 provider），内置免费 AI 结构上不可达，该改动零作用；一并恢复被 fork 删掉的 `read-frog-provider.png`，否则回退后 import 断链（importer 在上游侧，必须走重定向）
- [x] 4.8 utils 组：`utils.ts` 直接回退（`getReviewUrl` 唯一调用方是 `more-menu.tsx`，由 4.3 的 fork 壳不渲染该入口即可）；`notebase/pending-save.ts` → `src/fork/utils/` + 重定向，上游测试回退
- [x] 4.9 字幕与划词组：**改用资源级重定向**（`src/assets/icons/read-frog.png` → `src/fork/assets/renyimiao.svg`）一条覆盖字幕条与悬浮球两处品牌图，省掉两份要逐次对账的组件副本；`custom-action-button` 测试回退
- [x] 4.10 迁移脚本（决策 4）：**不要**把 customActions 修复搬进 `src/fork/config/migration.ts`——那条链只服务 fork 自己的 storage key，而这段修复修的是上游配置的 `selectionToolbar.customActions`；且回退 `v085-to-v086.ts` 后 schemaVersion ≥86 的存量用户再也不会经过那一步，修复会静默丢失。改新建 `src/fork/background/repair-custom-actions.ts`，由 `setupFork()` 调用、幂等、读到 null 就跳过，形态照抄同目录的 `correct-legacy-translation-mode.ts`。`v085-to-v086.ts`(+test) 回退上游版
- [x] 4.11 新建 `src/fork/identity/redirect-baseline.json`（以 `from` 路径为键存内容指纹），`ui-redirect-plugin` 的 `buildStart` 比对当前内容与记录值，失配即硬失败并提示「上游改了此文件，对账后更新指纹」。这是对「buildStart 只断路径不比内容」的机械兜底。两个约束：**指纹不塞进 `wxt.config.ts`**（那是冲突最频繁的 allowlist 文件，加 20+ 个每次同步都变的字段等于给它加冲突面）；**算法用「LF 归一化后 sha256」**，不用 `git hash-object` 或读工作树——本仓 `.gitattributes` 是 `* text=auto eol=lf`，跨平台检出会假失配
- [x] 4.12 存量扫描的源码级条目降到 43（只剩回退档）；三浏览器构建全绿；提交

## 5. 回退档：纯视觉整体回退（41 个）

- [x] 5.1 对以下文件执行 `git checkout $FORK_POINT -- <file>`：

```
src/assets/styles/theme.css
src/components/gradient-background.tsx
src/components/provider-icon.tsx
src/components/sortable-list.tsx
src/components/ui/base-ui/badge.tsx
src/components/ui/base-ui/button.tsx
src/components/ui/base-ui/card.tsx
src/components/ui/base-ui/combobox.tsx
src/components/ui/base-ui/dialog.tsx
src/components/ui/base-ui/dropdown-menu.tsx
src/components/ui/base-ui/input.tsx
src/components/ui/base-ui/popover.tsx
src/components/ui/base-ui/progress.tsx
src/components/ui/base-ui/select.tsx
src/components/ui/base-ui/sidebar.tsx
src/components/ui/base-ui/switch.tsx
src/components/ui/base-ui/tabs.tsx
src/components/ui/base-ui/textarea.tsx
src/components/ui/selection-popover/index.tsx
src/entrypoints/options/app-sidebar/whats-new-footer.tsx
src/entrypoints/options/components/config-card.tsx
src/entrypoints/options/components/metric-card.tsx
src/entrypoints/options/components/page-layout.tsx
src/entrypoints/options/pages/config/google-drive-sync/index.tsx
src/entrypoints/options/style.css
src/entrypoints/popup/components/ai-smart-context.tsx
src/entrypoints/popup/components/always-translate.tsx
src/entrypoints/popup/components/floating-button.tsx
src/entrypoints/popup/components/language-options-selector.tsx
src/entrypoints/popup/components/node-translation-hotkey-selector.tsx
src/entrypoints/popup/components/site-control-toggle.tsx
src/entrypoints/popup/components/translate-prompt-selector.tsx
src/entrypoints/selection.content/components/copy-button.tsx
src/entrypoints/selection.content/components/selection-toolbar-footer-content.tsx
src/entrypoints/selection.content/components/speak-button.tsx
src/entrypoints/selection.content/selection-toolbar/custom-action-button/custom-action-tool-button.tsx
src/entrypoints/selection.content/selection-toolbar/index.tsx
src/entrypoints/subtitles.content/ui/subtitles-settings-panel/panel-shell.tsx
src/entrypoints/translation-hub/components/text-input.tsx
src/entrypoints/translation-hub/components/translation-card.tsx
src/entrypoints/translation-hub/components/translation-panel.tsx
```

- [x] 5.2 `pnpm run test`——跟随视觉改过的断言会一起回退；若有测试失败说明该文件其实属于搬迁档，退回第 4 节处理
- [x] 5.3 三浏览器构建全绿
- [x] 5.4 `FORK_SCAN_ALL=1 node scripts/check-fork-boundary.mjs` 的输出里不再有任何 `.ts`/`.tsx`/`.css` 条目
- [x] 5.5 提交

## 6. 收尾验收

- [x] 6.1 干跑合并复测：`git merge-tree --write-tree --name-only HEAD fe2957c8` 冲突数应为 12（9 个 locales + `wxt.config.ts` + `src/utils/constants/app.ts` + `src/entrypoints/popup/app.tsx`），命令原文与输出贴进 PR
- [x] 6.2 人工冒烟（用户 2026-08-25 执行，**通过**）：popup 打开、网页翻译、划词翻译、字幕按钮、选项页各 tab、登录入口——确认视觉是上游样式但品牌 logo 与站点链接仍指向任译喵
- [x] 6.3 已确认 Discord / GitHub issues / 上游商店评价三个入口仍不可见
- [x] 6.4 更新 `FORK_GUIDE.md` §3、§6 与 `FORK.md`：登记新增重定向条目与 `redirect-baseline.json` 内容指纹机制、把「禁止原地改上游 UI」写成红线、记录两种边界检查模式的用法

> **冒烟记录（2026-08-25，用户执行）**
>
> - 通过：品牌图标（悬浮球 / 字幕条 / 侧边栏）、博客与登录链接指向 fork 站点、帮助按钮不通向上游 GitHub、上游社区入口不可见、options 三页插画、原有 provider 配置与自定义动作未被重置。
> - 期间发现并修复 1 个回归：popup 右侧露白（`a0decafe`）——上游 `main.tsx` 覆盖 `#root` 的 className，把 fork 的 392px 换回 320px。已改用行内 style 并加回归测试。
> - 误报 1 个：翻译按钮灰色。实为在 `chrome://extensions/` 打开 popup，命中上游 `isIgnoreUrl` 的忽略名单；换普通网页即正常。三个决定禁用状态的文件与分叉点逐字一致，非本次引入。

> **冒烟后修复（2026-08-25，用户定性为本次改动引出的问题，不另立项）**
>
> popup 加宽到 392px 后暴露两处布局问题，随本变更一并修掉（`2346e138`）：上游给语言选择器写死
> `w-30`，多出的空间全挤成中间留白；模式按钮沿用 `size="icon"` 的 36px，与同排 52px 的翻译按钮不等高。
> 另统一了账号行与底栏内边距。语言选择器是上游文件，按红线走影子壳 + 重定向（重定向增至 21 条，均已登记指纹）。
> 用户验收：可接受，不再调整。

- [x] 6.5 提 PR 到 `change/fork-foundation`，等人工审核
