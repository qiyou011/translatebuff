## 1. 上游同步拓扑（upstream-sync）

- [x] 1.1 添加 `upstream` remote 指向 `mengxi-ream/read-frog` 并 `git fetch upstream --tags`
- [x] 1.2 运行 `git merge-base --is-ancestor upstream/main main` 校验共享祖先（退出码 0）；若 DIVERGED 则停止并上报
- [x] 1.3 `git config rerere.enabled true` 并校验 `git config --get rerere.enabled` 为 `true`
- [x] 1.4 编写 `FORK.md`：同步仪式、take-theirs 热点清单、merge-only 不变量
- [x] 1.5 提交（docs(fork): add fork playbook and sync ritual）

## 2. fork 命名空间脚手架（fork-runtime-integration / fork-boundary-guard）

- [ ] 2.1 创建 `src/fork/message.ts`：独立 `defineExtensionMessaging<ForkProtocolMap>()`，导出 `sendForkMessage`/`onForkMessage`
- [ ] 2.2 创建 `src/fork/branding.ts`：`FORK_BRANDING = { name, websiteUrl, apiUrl }`（translatebuff 占位域名）
- [ ] 2.3 运行 `pnpm run type-check` 确认新文件通过
- [ ] 2.4 提交（feat(fork): scaffold fork namespace with isolated message channel and branding）

## 3. 边界纪律 CI（fork-boundary-guard）

- [ ] 3.1 [TDD] 编写 `scripts/__tests__/check-fork-boundary.test.ts`：断言 `src/fork/**` 放行、allowlist 放行、越界文件进 violations
- [ ] 3.2 运行测试确认失败（模块不存在）
- [ ] 3.3 编写 `scripts/fork-allowlist.json`：枚举 wxt.config.ts、background/index.ts、app.ts、各 app.tsx 壳、selection.content/index.tsx、auth/orpc 客户端、uninstall-survey.ts、9 个 locales
- [ ] 3.4 实现 `scripts/check-fork-boundary.mjs`：导出 `classifyChangedFiles(changed, allowlist)`，直接运行时对 git diff 判定并在越界时退出码 1
- [ ] 3.5 运行测试确认通过
- [ ] 3.6 新增 `.github/workflows/fork-guard.yml`：边界检查 + `pnpm run test` + chrome/edge/firefox 三构建 + 域名断言
- [ ] 3.7 提交（ci(fork): enforce fork boundary and 3-browser build gate）

## 4. B1 独立发版号（fork-identity）

- [ ] 4.1 [TDD] 编写 `src/fork/identity/__tests__/version.test.ts`：`computeForkVersion("1.40.2",3)==="1.40.2.3"`、非 3 段抛错
- [ ] 4.2 运行测试确认失败
- [ ] 4.3 创建 `src/fork/identity/fork-build.json`（`{ "forkBuildNumber": 0 }`）与 `src/fork/identity/version.ts`（`computeForkVersion` + `readForkBuildNumber`）
- [ ] 4.4 运行测试确认通过
- [ ] 4.5 在 `wxt.config.ts` manifest 工厂接入：`name = FORK_BRANDING.name`、`version = computeForkVersion(pkg.version, readForkBuildNumber())`、`version_name`
- [ ] 4.6 `pnpm run build` 后校验 `.output/chrome-mv3/manifest.json` 的 `name` 为品牌名、`version` 为 4 段
- [ ] 4.7 提交（feat(fork): compute independent 4-segment manifest version）

## 5. B3 后端指向 + 域名断言（fork-backend-repoint）

- [ ] 5.1 [TDD] 编写 `scripts/__tests__/assert-fork-build.test.ts`：`findUpstreamDomainHits` 命中/未命中两例
- [ ] 5.2 运行测试确认失败
- [ ] 5.3 实现 `scripts/assert-fork-build.mjs`：导出 `findUpstreamDomainHits`，直接运行时扫描 `.output` 并在命中上游域名时退出码 1
- [ ] 5.4 运行测试确认通过
- [ ] 5.5 `git add -f .env.production`：4 个 URL/origin/domain 指向 translatebuff + fork 自有 Google/PostHog 占位；创建本地 `.env`（不提交密钥）
- [ ] 5.6 在干净环境 `unset WXT_*` 后 `pnpm run build` + `node scripts/assert-fork-build.mjs` 通过（无 readfrog 域名）
- [ ] 5.7 提交（含 chore(fork): add fork production env + ci(fork): assert built bundle contains no upstream domains）

## 6. B2 fork 配置隔离（fork-settings-store）

- [ ] 6.1 [TDD] 编写 `src/fork/config/__tests__/config.test.ts`：默认值满足 schema、`migrateForkConfig({},0)` 可被 schema 解析
- [ ] 6.2 运行测试确认失败
- [ ] 6.3 创建 `src/fork/config/constants.ts`（`FORK_CONFIG_STORAGE_KEY`、`FORK_CONFIG_SCHEMA_VERSION`）与 `schema.ts`（`forkConfigSchema`、`DEFAULT_FORK_CONFIG`）
- [ ] 6.4 创建 `src/fork/config/migration.ts`（`migrateForkConfig`）与 `storage.ts`（`loadForkConfig` 用独立 `local:${FORK_CONFIG_STORAGE_KEY}`）
- [ ] 6.5 运行测试确认通过
- [ ] 6.6 提交（feat(fork): isolated fork config store with own storage key and migration chain）

## 7. fork 后台接线（fork-runtime-integration）

- [ ] 7.1 创建 `src/fork/background/index.ts`：`setupFork()` 注册 fork 消息处理器
- [ ] 7.2 在 `src/entrypoints/background/index.ts` 加一个 import + `main` 内首行 `setupFork()`（单行接入）
- [ ] 7.3 `pnpm run build` 成功；`node scripts/check-fork-boundary.mjs` 不因 background/index.ts 报越界（在 allowlist 内）
- [ ] 7.4 提交（feat(fork): wire fork background via single setupFork() call）

## 8. UI 壳层参考页（fork-runtime-integration）

- [ ] 8.1 阅读现有 `src/entrypoints/popup/app.tsx`，记录其消费的 atoms/消息契约
- [ ] 8.2 创建 `src/fork/ui/popup/App.tsx`：消费 atoms + ProtocolMap 的 fork popup 界面（Tailwind，纯 UI 豁免 TDD）
- [ ] 8.3 将 `src/entrypoints/popup/app.tsx` 缩为 `export { default } from "@/fork/ui/popup/App"` 壳层
- [ ] 8.4 `pnpm run build` 成功；加载 `.output/chrome-mv3` 手动确认 popup 渲染 fork 界面
- [ ] 8.5 提交（feat(fork): rebuild popup UI via app.tsx shell (reference pattern)）

## 9. 去品牌（fork-identity）

- [ ] 9.1 修改 `src/utils/constants/app.ts`：`APP_NAME = FORK_BRANDING.name`
- [ ] 9.2 阅读 `src/entrypoints/background/uninstall-survey.ts` 确认调研 URL 来源（locale/常量）
- [ ] 9.3 将卸载调研 URL 改为读 `FORK_BRANDING.websiteUrl` 派生值，避免改 9 个 locale
- [ ] 9.4 `pnpm run build` + 域名断言通过；记录残留的 `read-frog-selection`/`__READ_FROG_*` 命中供并存改名决策
- [ ] 9.5 提交（feat(fork): re-point app name and de-brand uninstall survey）

## 10. 停用 changesets + 演练同步（upstream-sync / fork-identity）

- [ ] 10.1 `git rm -r .changeset`，提交（chore(fork): drop changesets; version/CHANGELOG are take-theirs）
- [ ] 10.2 演练同步：`git fetch upstream && git switch -c sync/rehearsal main && git merge upstream/main`，确认冲突仅在 allowlist 内
- [ ] 10.3 `pnpm install` + `pnpm run test` + chrome/edge/firefox 三构建 + `node scripts/assert-fork-build.mjs` 全绿
- [ ] 10.4 清理演练分支（回 main、删 sync/rehearsal）；如 lockfile 有变更则提交

## 11. 收尾验证

- [ ] 11.1 运行完整 `pnpm run test` 全绿
- [ ] 11.2 校验 `node scripts/check-fork-boundary.mjs`（相对 origin/main）无 allowlist 外越界
- [ ] 11.3 三浏览器 `wxt build` 均成功且 `assert-fork-build.mjs` 通过
