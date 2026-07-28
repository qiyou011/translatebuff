# 实施任务：fork-options-feature-provider-gating

> 顺序：先共享门禁逻辑（TDD）→ popup 重构复用（防回归）→ fork 选项宿主 → 重定向接线 → 端到端验证。
> 全程守 fork 边界：净新增进 `src/fork/**`；`wxt.config.ts` 在 allowlist 内；绝不编辑上游源文件 / config schema。
>
> **实施偏离（TDD 反馈）**：因 `provider-registry` 直接 import i18n、vitest 无 yml 插件，把纯逻辑拆成
> `renyimiao-gating.ts`（i18n-free、可测）+ `use-renyimiao-gating.tsx`（hook + Fallback 组件），而非单文件。

## 1. 共享门禁逻辑（TDD 纯函数 + hook + 组件）

- [x] 1.1 新建 `src/fork/ui/providers/renyimiao-gating.ts`，纯函数 `computeRenyimiaoGating(allProviders, renyimiaoApiKey, selectedId): { providers, showFallback }`。
- [x] 1.2 先写 `src/fork/ui/providers/__tests__/renyimiao-gating.test.ts` 覆盖 5 分支，跑确认红（模块未建即红）。
- [x] 1.3 补齐实现，`vitest run src/fork/ui/providers` 转绿（5 passed）。
- [x] 1.4 `use-renyimiao-gating.tsx` 内 hook `useRenyimiaoGatedProviders(capability, selectedId)`（读 providersConfig → getSelectable + renyimiaoApiKey → computeRenyimiaoGating）。
- [x] 1.5 同文件组件 `RenyimiaoGatedFallback`（无 props，自取 forkSessionAtom + useOpenForkLogin；三态：登录钮 / 获取中）。
- [x] 1.6 `pnpm run type-check` 绿。

## 2. popup 重构复用共享逻辑（行为等价、防回归）

- [x] 2.1 `FeatureRow` 改用 `useRenyimiaoGatedProviders(featureKey, providerId)` + `showFallback ? <RenyimiaoGatedFallback/> : <ForkProviderSelector/>`。
- [x] 2.2 `CustomActionRows` 提取每行组件 `CustomActionRow`（每行调 hook，避免 Rules-of-Hooks），同款替换。
- [x] 2.3 删除本地 `RenyimiaoGatedFallback` 及 `ForkSession` 类型 import；保留顶部登录横幅与 `useEnsureRenyimiaoSeeded()`。
- [x] 2.4 清理未用 import（`isRenyimiaoInstance`/`renyimiaoApiKey`/`ForkSession`；`Button` 仍被 DrawerTrigger 用，保留）。type-check 绿。
- [x] 2.5 全量单测确认 popup 无回归（2195 passed / 0 failed）。

## 3. fork 选项宿主换皮（feature-provider-selector-list）

- [x] 3.1 新建 `src/fork/ui/options/feature-provider-selector-list.tsx`，`export { needsApiKeyWarning } from "上游同名模块"`（wxt 自引豁免，不自环）。
- [x] 3.2 复刻 `FeatureProviderField`（对齐 props/FieldLabel），行体用共享 hook + Fallback；`triggerSize` 默认 `"default"`。
- [x] 3.3 复刻 `CustomActionProviderFields` + 提取 per-action 组件 `CustomActionProviderField`（空列表 return null + 段头 + placeholder），同款替换。
- [x] 3.4 复刻 `FeatureProviderSelectorList`（props 面 1:1，`providerSelectorClassName` 默认 `"w-full"`、`includeCustomActions` 默认 `true`）；挂 `useEnsureRenyimiaoSeeded()`。
- [x] 3.5 直接 `import ForkProviderSelector`。type-check 绿。（附：showFallback 时抑制上游缺 key 警告，仅非任译喵缺 key 走上游 renderApiKeyWarning。）

## 4. 重定向接线（wxt.config）

- [x] 4.1 `FORK_UI_REDIRECTS` 增 `feature-provider-selector-list.tsx` → fork 宿主。
- [x] 4.2 确认 fork 宿主导出 `FeatureProviderSelectorList` + re-export `needsApiKeyWarning`（上游 wrapper 具名导入两者）。
- [x] 4.3 type-check 绿；`check-fork-boundary` 无越界（新增文件在 `src/fork/`、`wxt.config.ts` 在 allowlist）。

## 5. 端到端验证 + 实机

- [x] 5.1 全量单测绿（`.env` 移开）：2195 passed / 0 failed。
- [x] 5.2 `node scripts/check-fork-brand.mjs` 通过。
- [x] 5.3 `node scripts/pack.mjs test` 构建测试包成功（改动不破坏构建）。
- [x] Simplify（TAVS 阶段 4）：审查发现 popup 手写行与 fork 宿主逐行同构 → popup 抽屉体改为直接复用 `<FeatureProviderSelectorList providerSelectorTriggerSize="sm" />`，删 FeatureRow/CustomActionRow/CustomActionRows（~90 行），门禁规则只住 fork 宿主一处。type-check/构建/全量单测复验全绿。（跳过：跨 providers-config 抽共享登录引导原语——越出本 diff，记为后续。）
- [ ] 5.4 实机（登出态装测试包）：选项页「通用」页——网页翻译等仍显 Microsoft/Google（任译喵隐藏）；词典/自定义 AI 指令仅任译喵的显「登录后自动获取模型」+登录钮；非任译喵缺 key 仍显上游警告；popup 三面无回归；无恢复模式崩溃。
- [ ] 5.5 汇报四关 + 实机结果，等用户确认（不自动提交）。
