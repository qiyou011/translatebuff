# 实施任务：fork-hide-google-drive-sync

> 顺序：fork 空组件 → 重定向插件迁入 fork（TDD，含桶导入预筛修复）→ wxt.config 接线+清死 import → 加重定向条目 → 端到端验证。
> 守 fork 边界：净新增进 `src/fork/**`；`wxt.config.ts` 在 allowlist；绝不编辑上游 `config/index.tsx` / config schema。

## 1. fork 空组件

- [x] 1.1 新建 `src/fork/ui/options/google-drive-sync-card.tsx`：`export function GoogleDriveSyncCard() { return null }`，顶部注释说明「隐藏上游 Google Drive 云端同步卡、经 wxt.config 重定向顶替、渲染空」（对齐 notebase-connection-field / save-suggestion-toggle 写法）。

## 2. 重定向插件迁入 fork + 桶导入预筛修复（TDD）

- [x] 2.1 先写 `src/fork/__tests__/ui-redirect-plugin.test.ts`，import `forkUiRedirectPlugin`（尚不存在→红）。用例（mock `this.resolve` 返回指定 id 后调 `p.resolveId.call(mockCtx, source, importer, {})`）：① 目录桶：redirects 含 `{from:"/x/config/google-drive-sync/index.tsx", to:"/x/fork/gds.tsx"}`，`resolve→该 index.tsx`，`resolveId("./google-drive-sync","/x/config/index.tsx")` → 返回 `/x/fork/gds.tsx`；② 单叶子：`{from:"/x/foo.tsx", to:"/x/bar.tsx"}`，`resolve→foo.tsx`，`resolveId("./foo",importer)` → `/x/bar.tsx`；③ 非匹配 resolve id → null；④ importer 缺失 → null；⑤ 自引（importer === to）→ null。跑确认红（模块未建）。
- [x] 2.2 新建 `src/fork/ui-redirect-plugin.ts`：从 `wxt.config.ts` 逐字迁入 `normalizeModuleId` + `forkUiRedirectPlugin`，工厂签名改为 `forkUiRedirectPlugin(redirects: { from: string; to: string }[]): Plugin`（`redirects` 入参、不再引用 `FORK_UI_REDIRECTS`）。只 `import type { Plugin } from "vite"` + `import { existsSync } from "node:fs"`。含预筛修复：`targetBasenames` 构造改为 `redirects.flatMap(r => { const seg = normalizeModuleId(r.from).split("/"); const base = seg.pop()!; return base === "index" ? [base, seg.pop()!] : [base] })`。匹配关/自引豁免/buildStart existsSync 逐字不变。跑测试转绿。
- [x] 2.3 补预筛/归一化测试：桶 `from`（`.../dir/index.tsx`）→ 预筛集含 `dir` 与 `index`；叶子 `from`（`.../foo.tsx`）→ 含 `foo`；`normalizeModuleId` 去 `?url` query、反斜杠归一化。跑绿。
- [x] 2.4 `pnpm run type-check` 绿。

## 3. wxt.config 接线 + 清死 import

- [x] 3.1 `wxt.config.ts`：删除内联的 `forkUiRedirectPlugin` 工厂体与 `normalizeModuleId` 定义；改 `import { forkUiRedirectPlugin } from "./src/fork/ui-redirect-plugin"`；plugins 处改为 `forkUiRedirectPlugin(FORK_UI_REDIRECTS)`（`FORK_UI_REDIRECTS` 数组仍留 wxt.config、`path.resolve(__dirname,…)` 不动）。
- [x] 3.2 清死 import：删顶部 `import type { Plugin } from "vite"`；`import { existsSync, readFileSync } from "node:fs"` 降为 `import { readFileSync } from "node:fs"`（readFileSync 仍读 package.json）。
- [x] 3.3 `pnpm run type-check` 绿；确认既有 7 条叶子重定向仍在 `FORK_UI_REDIRECTS`、行为不变。

## 4. 加 Google Drive 重定向条目

- [x] 4.1 `wxt.config.ts` 的 `FORK_UI_REDIRECTS` 加条目：`from = path.resolve(__dirname, "src/entrypoints/options/pages/config/google-drive-sync/index.tsx")` → `to = path.resolve(__dirname, "src/fork/ui/options/google-drive-sync-card.tsx")`。
- [x] 4.2 `pnpm run type-check` 绿；`FORK_DIFF_BASE=HEAD node scripts/check-fork-boundary.mjs` 无越界（新文件在 `src/fork/`、`wxt.config.ts` 在 allowlist）。

## 5. 端到端验证 + 实机

- [x] 5.1 全量单测绿（`.env` 移开）：`SKIP_FREE_API=true pnpm exec vitest run` → 恢复 `.env`（含新插件测试 + 既有全绿、无回归）。
- [x] 5.2 `node scripts/check-fork-brand.mjs` 通过。
- [x] 5.3 `node scripts/pack.mjs test` 构建成功（构建期走通迁移后的插件 + 新重定向，7 条既有重定向不 buildStart 报错）。
- [ ] 5.4 实机：打开选项页「配置」页——**Google Drive 云端同步卡不再出现**；同页 Beta 体验 / 手动配置同步 / 配置备份 / 关于 / 重置 照常；其它经重定向的 fork UI（provider 选择器 / API 提供商页 / notebase / save-suggestion / 功能提供商）无回归。
- [ ] 5.5 汇报四关 + 实机结果，等用户确认（不自动提交）。
