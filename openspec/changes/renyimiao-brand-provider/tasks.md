## 1. 品牌改名（中文主名"任译喵"）

- [x] 1.1 `src/fork/branding.ts`：保留 `name:"Translatebuff"`（ASCII 技术标识，APP_NAME 靠它稳定）；新增 `displayName:"任译喵"`（中文显示名）
- [x] 1.2 `src/utils/constants/app.ts`：`APP_NAME` 仍取 `FORK_BRANDING.name`（不变，保 DB 库名/自定义元素名等技术标识稳定）——审计确认 `APP_NAME` 无需改（其下游多为技术标识）
- [x] 1.3 popup 头（`src/fork/ui/popup/App.tsx`）改取 `FORK_BRANDING.displayName`；`gecko.id` 保持 `translatebuff@translatebuff.com`
- [ ] 1.4 提交（`M src/fork/branding.ts`、`M src/fork/ui/popup/App.tsx`）

## 2. 预发布版本号 0.0.x（TDD）

- [x] 2.1 `src/fork/identity/version.ts`：改 `computeForkVersion(forkBuild)` 返回 `0.0.${forkBuild}`；新增 `computeForkVersionName(pkgVersion, forkBuild, brandName)` 返回 `${brandName} 0.0.${forkBuild}（rf ${pkgVersion}）`，保留对 `pkgVersion` 的 3 段合法性校验
- [x] 2.2 更新 `src/fork/identity/__tests__/version.test.ts`：断言 `computeForkVersion(1)==="0.0.1"`、`computeForkVersionName("1.40.2",1,"任译喵")==="任译喵 0.0.1（rf 1.40.2）"`、非法上游版本仍抛错
- [x] 2.3 `src/fork/identity/fork-build.json`：`forkBuildNumber` `0`→`1`
- [x] 2.4 `wxt.config.ts`：manifest `version` 调 `computeForkVersion`、`version_name` 调 `computeForkVersionName`（品牌取中文显示名）
- [x] 2.5 `pnpm run build` 后验证 `manifest.json` 的 `version==="0.0.1"`、`version_name==="任译喵 0.0.1（rf 1.40.2）"`

## 3. 任译喵多实例 seed + 隐藏默认 LLM provider（后台 · TDD）

- [x] 3.1 新建 `src/fork/providers/renyimiao.ts`：`RENYIMIAO_ID_PREFIX`、`RENYIMIAO_GATEWAY_BASE_URL`（注释"不随环境切换"）、`HIDDEN_DEFAULT_PROVIDER_IDS`（`openai/deepseek/atlascloud-default`）、`RENYIMIAO_MODELS`：`Deepseek-V4-Flash`（大小写敏感）→ `available:true`；`gpt-5.5`、`qwen3.5-plus` → `available:false`
- [x] 3.2 `buildRenyimiaoProvider(model)`：单模型实例（`id="renyimiao-<modelId>"`、`name="任译喵 <label>"`、`model={model:"use-custom-model",isCustomModel:true,customModel:<modelId>}`）
- [x] 3.3 `computeForkConfigSync(config)`：补齐可用模型实例 + 移除 `openai/deepseek/atlascloud-default` + 移除过期任译喵实例（保留已有 `apiKey`）+ 把悬空功能 `providerId` 兜底到 `microsoft-translate-default`；无变化返回 `null`
- [x] 3.4 `src/fork/providers/__tests__/renyimiao.test.ts`：实例过 zod、缺 `use-custom-model` 失败、隐藏默认 LLM、悬空兜底、幂等返回 null、保留 apiKey
- [x] 3.5 `src/fork/background/index.ts`：`setupFork()` 启动时读 storage → `computeForkConfigSync` → `mergeWithArrayOverwrite` 应用补丁写回（popup/选项页由 `storage.watch` 感知）
- [x] 3.6 跑 `SKIP_FREE_API=true pnpm run test` 相关用例转绿

## 4. popup：纯沿用陪读蛙完整面板（表现层）

- [x] 4.1 `src/fork/ui/popup/App.tsx`：照搬上游 popup 完整布局与组件（账户菜单 / 语言 / `ProvidersField` / 翻译模式 + 按钮 / 站点开关 / 快捷键 / 智能上下文 / 底部选项+版本+更多），无 fork 块
- [x] 4.2 footer 版本号取 `EXTENSION_VERSION`（fork `0.0.1`）
- [ ] 4.3 `pnpm dev` 浏览器手动验证：popup 呈现陪读蛙完整面板，任译喵模型出现在 `ProvidersField` 选择器、Atlas Cloud 不再出现（待用户实测）

## 5. 边界护栏收口（TDD）

- [x] 5.1 `scripts/check-fork-boundary.mjs`：把 fork 自有/自改根文件收进 `FORK_ROOT_FILES` 集合，在 `FORK.md`/`.env.production`/`.env` 之外新增 `FORK_GUIDE.md`、`CLAUDE.md`、`.gitignore`
- [x] 5.2 `scripts/__tests__/` 补边界单测：改动含 `FORK_GUIDE.md`/`CLAUDE.md`/`.gitignore` 时 violations 不含它们
- [x] 5.3 跑 `FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs`，确认整体无越界（分支转绿）
- [ ] 5.4 提交

## 6. 门禁与验收

- [x] 6.1 `SKIP_FREE_API=true pnpm run test` 全绿（1815 passed / 4 skipped）
- [x] 6.2 `pnpm run build` + `build:edge` + `build:firefox` 三目标构建通过
- [x] 6.3 `node scripts/assert-fork-build.mjs` 通过（fork 域名生效）
- [x] 6.4 `FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs` 通过（无越界）
- [ ] 6.5 冒烟：在 provider 选择器选中"任译喵 DeepSeek-V4-Flash"、选项页填 key 后，网页翻译经 openai-compatible 直连路径成功走任译喵网关；Atlas Cloud 不在列表（待用户实测）
