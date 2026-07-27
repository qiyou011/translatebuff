## 1. 降级 helper（结构化输出 json_object）· TDD

- [x] 1.1 写 helper 单测 `src/fork/providers/__tests__/custom-action-response-format.test.ts`（RED）：
      ① 任译喵 ref（`kind:"local"` + `renyimiao-` 前缀 openai-compatible 实例）经 helper 后 `config.providerOptions.response_format` 为 `{type:"json_object"}`；
      ② 合入 recommended：deepseek-v4-flash 情形同时保留 `thinking:{type:"disabled"}`；
      ③ 不可变：调用后**原**传入的 config 对象 `providerOptions` 保持不变（注入前 undefined 则仍 undefined）；
      ④ 豁免：`kind:"system"`（内置免费 AI）、无 `renyimiao-` 前缀的 local ref（用户自带 LLM）原样返回、不注入。
- [x] 1.2 跑 `SKIP_FREE_API=true pnpm run test -- custom-action-response-format` 确认全红（helper 未实现）。
- [x] 1.3 实现 `src/fork/providers/custom-action-response-format.ts`：`withRenyimiaoJsonObjectFormat(ref)`——守卫 `ref.kind==="local" && isRenyimiaoInstance(ref.config)`，否则原样返回；命中则**不可变复制** `{ ...ref, config: { ...ref.config, providerOptions: { ...(config.providerOptions ?? getRecommendedProviderOptions(resolveModelId(config.model)) ?? {}), response_format: { type: "json_object" } } } }`。复用上游 `getRecommendedProviderOptions` / `resolveModelId` + fork `isRenyimiaoInstance`。
- [x] 1.4 跑测试确认全绿；`pnpm run type-check` 0 报错（留意 ref 真实类型 `ProviderRef` 对齐）。

## 2. 接入词典执行链 + 集成断言

- [x] 2.1 写集成断言（RED）：构造任译喵 provider ref + 默认词典 action，跑 fork 词典执行链的请求构建（`buildCustomActionExecutionPlan` → `buildCustomActionExecutionRequest`），断言透传给 `streamText` 的 `providerOptions` 为 `{ "openai-compatible": { response_format: {type:"json_object"}, thinking:{type:"disabled"} } }`（即 helper 注入经 `getProviderOptionsWithOverride` 后到 streamText 入参层）。可选加固：针对 `@ai-sdk/openai-compatible` 的 `getArgs` 补一条「请求体 `response_format` 为 json_object」的窄断言。
- [x] 2.2 跑测试确认红（controller 尚未接入 helper）。
- [x] 2.3 改 `src/fork/ui/selection-content/use-custom-action-controller.ts`：构造 `customActionRequest.provider` 处，把 `resolveProviderRefForCapability(...)` 的结果过一层 `withRenyimiaoJsonObjectFormat(...)`（1 处改动）。
- [x] 2.4 跑测试确认绿；`type-check` 0。

## 3. 词典入口回归 + 齿轮移除

- [x] 3.1 在 `src/fork/ui/selection-content/__tests__/shell-invariants.test.ts` 补防齿轮回归断言（RED）：`SelectionToolbar.tsx` 不含 `default-dictionary` 特例分支、不 import `SettingsButton`/`SelectionToolbarSettingsButton`。
- [x] 3.2 跑测试确认红。
- [x] 3.3 改 `SelectionToolbar.tsx`：删 `:540-547` 的 `default-dictionary` 三元拦截，统一 `<CustomActionTrigger key={action.id} action={action} />`；删 `:36` 对 `SelectionToolbarSettingsButton` 的 import。删除文件 `src/fork/ui/selection-content/SettingsButton.tsx`。
- [x] 3.4 跑测试确认绿（新断言 + 既有「省略 notebase」「D4 三元组绑定」两条不变量均通过）。

## 4. 全量验证（四关 + 实机）

- [x] 4.1 全量单测：临时移开本地 `.env`（其 `WXT_WEBSITE_URL` 会挂上游 guide 测试）→ `SKIP_FREE_API=true pnpm run test` → 跑完恢复 `.env`。
- [x] 4.2 `pnpm run type-check`（0 报错）。
- [x] 4.3 `FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs`（无越界、零 allowlist 增长）。
- [x] 4.4 `node scripts/check-fork-brand.mjs`（品牌守卫）。
- [ ] 4.5 实机（改动均在 fork TS 文件，HMR 即可；如涉后台需完整重启 dev）：选中单词 → 点📖词典 → 弹出 7 字段结构化结果（词条/音标/词性/释义/段落/段落翻译/难度）；工具栏无齿轮、有词典按钮；整页 / 划词普通翻译仍正常（未被 json_object 影响）。
