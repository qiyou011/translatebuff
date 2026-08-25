# 阶段 1：同步上游至 v1.43.6

目标提交：`53b54d68`（`chore(release): version packages (#1987)`，v1.43.6）
工作分支：`feat/upstream-sync-v1-43-6`，从 `change/fork-foundation` 切出，以 PR 合回 `change/fork-foundation`。

## 0. 前置门禁

- [ ] 0.1 确认 `fork-ui-revert-upstream-visuals` 已合入 `change/fork-foundation` 且 CI 全绿
- [ ] 0.2 `FORK_SCAN_ALL=1 node scripts/check-fork-boundary.mjs`（基准自动取 `src/fork/identity/upstream-baseline.json` 的 `forkPointSha`）输出中无任何 `.ts`/`.tsx`/`.css` 条目——有则中止，回去清理
- [ ] 0.3 `git config rerere.enabled true` 确认已开
- [ ] 0.4 重跑干跑合并 `git merge-tree --write-tree --name-only change/fork-foundation 53b54d68`，把冲突清单贴进 PR 草稿。阶段 0 之后预期只剩 `wxt.config.ts`（allowlist 内）；若仍出现 `.tsx` 冲突，说明阶段 0 有遗漏

## 1. 合并

- [ ] 1.1 `git switch -c feat/upstream-sync-v1-43-6 change/fork-foundation`
- [ ] 1.2 `git merge 53b54d68`
- [ ] 1.3 解冲突：A 类一律 `git checkout --theirs <file>`；`pnpm-lock.yaml` 取 theirs 后交给 `pnpm install` 重算
- [ ] 1.4 `wxt.config.ts` 手工解：逐项确认 fork 的 4 段版本号注入、`gecko.id`、`artifactTemplate`、渠道号后缀、`FORK_UI_REDIRECTS` 全部保留，上游的 25 行改动全部接受
- [ ] 1.5 `pnpm install` 重生成 lockfile
- [ ] 1.6 提交合并结果。⚠️ 此时 `pnpm run build` **预期是红的**——本段有 4 条重定向的 `from` 被上游改过，`buildStart` 会因内容指纹失配而硬失败。这是设计行为，走第 2 节对账，**不要直接刷新指纹**

## 2. 换皮对账（指纹失配的唯一正确出口）

- [ ] 2.1 逐条打印本段区间内被上游改过的 4 条重定向源：`git diff e15e5b68..53b54d68 -- src/utils/host/translate/api/microsoft.ts`、`... providers-config.tsx`、`... selection-toolbar-save-suggestion-toggle.tsx`、`... feature-provider-selector-list.tsx`
- [ ] 2.2 逐条判断上游改动要不要搬进 fork 副本，判断结论（搬 / 不搬 + 理由）写成表贴进 PR。`microsoft.ts` 是 `FORK.md` 点名的最高危项，端点与请求形状的任何变化都必须逐字比对
- [ ] 2.3 需要搬的改动搬进对应 fork 副本，并在 `src/fork/**/__tests__/` 补测
- [ ] 2.4 **确认对账完成后**才更新 `src/fork/identity/redirect-baseline.json` 里这 4 条的指纹；另外 7 条未变、指纹不动
- [ ] 2.5 `pnpm run build` 转绿；提交

## 3. 契约与哨兵（构建门之前跑，失败早暴露）

- [ ] 3.1 diff `@read-frog/definitions` `0.3.5` → `0.4.0` 与 `@read-frog/api-contract` `0.11.0` → `0.12.0` 的 `AUTH_BASE_PATH` / `ORPC_PREFIX` / `AUTH_COOKIE_PATTERNS` / orpc 路由形状，结果贴进 PR（无变化也要写明）
- [ ] 3.2 单跑漂移哨兵 `pnpm vitest run src/fork/providers/__tests__/upstream-decode-drift.test.ts`
- [ ] 3.3 若哨兵变红：删掉 `src/fork/providers/microsoft-translate.ts` 里的 `decodeHTMLStrict`，重跑至绿
- [ ] 3.4 单跑 fork 侧全部测试 `pnpm vitest run --config vitest.fork.config.ts src/fork`（该配置由阶段 0 引入，重定向在此生效），确认换皮逻辑未被上游改动打断
- [ ] 3.5 提交

## 4. 全绿门禁

- [ ] 4.1 `pnpm run test`
- [ ] 4.2 `pnpm run build && pnpm run build:edge && pnpm run build:firefox`
- [ ] 4.3 `node scripts/assert-fork-build.mjs`
- [ ] 4.4 `FORK_SYNC_MODE=1 node scripts/check-fork-boundary.mjs`——**同步分支必须走同步模式**。用增量模式（基准 `origin/change/fork-foundation`）会把 290 个上游文件全判越界，PR 自己被拦死。此时 HEAD 已不是合并提交，若脚本推导不出基准会硬失败（设计如此，不会静默降级），显式补 `FORK_SYNC_BASE=53b54d68` 即可
- [ ] 4.5 `node scripts/check-fork-brand.mjs`——上游本段新增的带 "Read Frog" 字样的串会在此被揪出，重刷成 fork 品牌
- [ ] 4.6 人工比对 `.output/chrome-mv3/manifest.json` 的 `name` / `version`(4 段) / `version_name` / `browser_specific_settings.gecko.id`，与合并前的产物逐字段对齐
- [ ] 4.7 提交

## 5. 配置迁移验证

- [ ] 5.1 确认上游 `v086-to-v087`、`v087-to-v088` 两个脚本已合入，`CONFIG_SCHEMA_VERSION` 为 88
- [ ] 5.2 从现网测试包导出一份真实存量配置，跑一次迁移，比对迁移前后的 `providersConfig` 条目数与各功能 `providerId` 指向
- [ ] 5.3 确认 fork 独立迁移链（`src/fork/config/migration.ts`）与上游链在同一次启动里互不干扰，fork 侧 `membership` 字段不丢
- [ ] 5.4 把 5.2 的前后对比贴进 PR

## 6. 人工冒烟（WXT 大版本升级必做，单测覆盖不到）

- [ ] 6.1 `node scripts/pack.mjs test` 打测试包，Chrome load unpacked 装载
- [ ] 6.2 网页翻译：任选一篇长文，双语模式译全文
- [ ] 6.3 划词翻译：选中文本，浮窗出现且译文正确
- [ ] 6.4 字幕：YouTube 视频开字幕翻译
- [ ] 6.5 popup：品牌名、provider 选择器、翻译模式切换
- [ ] 6.6 options：各 tab 可达，任译喵 API 块的连接检测与更新模型可用
- [ ] 6.7 登录：走一次登录流程，确认会员态读取正常（验证 3.1 的契约结论）
- [ ] 6.8 上游引擎修复抽验：同源导航切页不闪烁（#1982）、含图标字体的页面不被误译（#1986）
- [ ] 6.9 把冒烟结果逐条记进 PR

## 7. 收尾

- [ ] 7.1 `src/fork/identity/fork-version.json` 版本号递增，`version_name` 的上游溯源更新为 `rf 1.43.6`
- [ ] 7.2 更新 `src/fork/identity/upstream-baseline.json`：`lastSyncedSha` = `53b54d68`、`lastSyncedVersion` = `1.43.6`。**这一步漏了，阶段 2 的同步模式与前置门禁都会用错基准**
- [ ] 7.3 `FORK.md` 记录本次落脚点 SHA，供下次 `git diff <上次同步SHA>..upstream/main` 用
- [ ] 7.4 提 PR 到 `change/fork-foundation`，等人工审核
