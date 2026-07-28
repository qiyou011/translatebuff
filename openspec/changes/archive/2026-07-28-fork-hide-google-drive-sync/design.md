# 技术设计：fork-hide-google-drive-sync

## Context

选项页「配置」页 `src/entrypoints/options/pages/config/index.tsx:6` 以**目录桶导入** `import { GoogleDriveSyncCard } from "./google-drive-sync"` 渲染 Google Drive 云端同步卡片（真身在 `google-drive-sync/index.tsx` 的 named 导出，无 props）。该卡片是唯一 live importer；`useGoogleDriveAuth` 仅被此卡片子树使用；`src/entrypoints/background` 不引用 google-drive——**无后台自动同步**。

fork 已有隐藏上游 UI 块的套路：新建 fork 空组件 + `wxt.config.ts` 的 `FORK_UI_REDIRECTS` 加一条重定向（先例 `notebase-connection-field`、`save-suggestion-toggle`）。但那两个是**单叶子文件**导入；本卡片是**目录桶导入**，触发现有重定向插件 `forkUiRedirectPlugin` 的 basename 预筛盲区：预筛 `targetBasenames.has(source 末段)`，桶导入 source 末段为 `google-drive-sync`，而 `from` 指 `index.tsx` 时预筛集只有 `index` → 早退、重定向静默失效（`existsSync(from)` 仍过、boundary/brand 全绿，只人工可察）。三轮架构审查确认：必须改预筛，且为消除循环依赖与补可测性，把插件整搬进 fork。

## Goals / Non-Goals

**Goals:**

- 选项页配置页不再展示 Google Drive 同步卡（经重定向到 fork 空组件）。
- 修复 fork UI 重定向预筛，使目录桶导入不再静默失效，一处修复令未来所有桶重定向生效。
- 重定向插件迁入 fork 领地、重定向清单作入参传入，消除潜在循环依赖并使重定向判定可单测。

**Non-Goals:**

- 不删除 `google-drive-sync/**` 子树与 `src/utils/google-drive/*`（隐藏后成死代码，按 fork 纪律保留、仅提一句）。
- 不编辑上游 `config/index.tsx`、不改 config schema / 后端。
- 不改动配置页其它板块（Beta 体验 / 手动配置同步 / 配置备份 / 关于 / 重置）。

## Decisions

### D1：重定向到 fork 空组件（不编辑上游）

新建 `src/fork/ui/options/google-drive-sync-card.tsx` 导出 `GoogleDriveSyncCard`（`return null`），经 `FORK_UI_REDIRECTS` 顶替上游 `config/google-drive-sync/index.tsx`。与 `notebase-connection-field` / `save-suggestion-toggle` 同型。`config/index.tsx` 不改；隐藏后子树死代码保留。

### D2：修复预筛支持目录桶导入（index → 登记父目录名）

`targetBasenames` 的构造从「每条取 `from` 末段」改为：末段为 `index` 时同时登记末段与**父目录名**。桶导入 `"./google-drive-sync"`（末段 `google-drive-sync`）由此放行预筛；匹配关 `normalizeModuleId(resolved.id) === normalizeModuleId(from)`（`from` 仍指 `index.tsx`、`resolved.id` 为 `.../google-drive-sync/index`）不变。对既有 7 条叶子重定向是**加性等价**（`base !== "index"` 仍走 `[base]`）。预筛放宽只增一次 `this.resolve` 开销，绝不产生错误重定向（精确匹配关兜底）——审查已用同名碰撞模块 `utils/atoms/google-drive-sync` 实证 false-allow 安全。

### D3：整搬插件进 fork + 入参传 redirects（消除循环依赖、可测）

新建 `src/fork/ui-redirect-plugin.ts`（C 类），迁入 `normalizeModuleId` 与 `forkUiRedirectPlugin` 工厂，签名改为 `forkUiRedirectPlugin(redirects: { from: string; to: string }[]): Plugin`。`FORK_UI_REDIRECTS`（含 `path.resolve(__dirname, …)`）**仍留 wxt.config 计算**（`__dirname` 必须是仓根，移进 fork 会崩全部路径），作入参传入。wxt.config 改为 `import { forkUiRedirectPlugin }` + `forkUiRedirectPlugin(FORK_UI_REDIRECTS)` 接线，不再自定义 plugin 体。该 fork 模块是叶子（只 `import type { Plugin } from "vite"` + `existsSync from "node:fs"`），不 import wxt.config、不 import i18n，vitest 可安全单测。先例：wxt.config 已 import `src/fork/identity/version`。

### D4：resolveId 级 firing 测试（真守住"重定向触发"）

单测直接构造插件实例、以 mock 的 `this.resolve` 调 `p.resolveId.call(mockCtx, source, importer, {})`，断言桶导入返回 fork `to`——覆盖预筛→resolve→匹配→自引豁免整条链。若有人回退 D2 修复，预筛集缺 `google-drive-sync` → 返回 null → 测试红。这补上现有插件的零测试空缺，把静默失效变响亮。

### D5：清理随插件迁走的死 import

wxt.config 顶部 `import type { Plugin } from "vite"` 与 `existsSync`（迁入 fork 插件）成为死 import，须在同一改动内清：`Plugin` 整行删，`import { existsSync, readFileSync }` 降为 `import { readFileSync }`（`readFileSync` 仍用于读 package.json 版本）。

### 文件结构与接口

| 操作 | 文件                                             | 职责                                                                                                    |
| ---- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| A    | `src/fork/ui/options/google-drive-sync-card.tsx` | fork 空组件 `export function GoogleDriveSyncCard() { return null }`                                     |
| A    | `src/fork/ui-redirect-plugin.ts`                 | 迁入 `normalizeModuleId` + `forkUiRedirectPlugin(redirects)` 工厂（含 D2 预筛修复）                     |
| A    | `src/fork/__tests__/ui-redirect-plugin.test.ts`  | resolveId 级 + 预筛/归一化单测                                                                          |
| M    | `wxt.config.ts`                                  | `FORK_UI_REDIRECTS` 加 Google Drive 条目；import + 接线 fork 插件；删插件体/normalizeModuleId/死 import |

**接口契约：**

- `forkUiRedirectPlugin(redirects: { from: string; to: string }[]): import("vite").Plugin`
- `normalizeModuleId(id: string): string`（去反斜杠 / 去 `?query` / 去 `.tsx?`/`.jsx?` 扩展名，逐字沿用现实现）
- `GoogleDriveSyncCard(): null`（named 导出，匹配上游 import）
- `FORK_UI_REDIRECTS` 仍是 wxt.config 内的 `{ from: string; to: string }[]`（绝对路径由 `path.resolve(__dirname, …)` 算）

## Risks / Trade-offs

- **产物级断言缺口（可接受、同构）**：无「构建产物内 Google Drive 卡片确为空」的断言。若上游改了 import specifier 却保留 `index.tsx`，`existsSync` 仍过、单测仍过、重定向静默失效、上游卡片泄漏。但这与现有 7 条重定向完全同构（都靠 buildStart existsSync + 同步仪式 merge review），且 `config/index.tsx` 是上游 take-theirs 文件、import 变更会在 merge review 浮现。**可选加固**（非本次必做）：扩 `assert-fork-build.mjs` 断言 options 产物不含 Google Drive 同步特征串。
- **预筛放宽的开销**：对 `./*/index` 形态 specifier 多跑一次 `this.resolve`（构建期、可忽略），精确匹配关兜底不误伤。
- **迁移逐字等价风险**：`normalizeModuleId` 与插件三关逻辑须逐字迁移、行为不变；D4 的 resolveId 测试 + 全量单测兜住既有 7 条叶子重定向不回归。
