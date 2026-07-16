## 1. fork 选择器 → 只任译喵 + 普通翻译

- [x] 1.1 `src/fork/components/provider-selector.tsx`：base-ui `Select` 自绘（default 导出），复用 `ProviderIcon`/`getProviderName`/`getProviderLogo`；空态 placeholder+disabled；任译喵组去「任译喵 」前缀
- [x] 1.2 `provider-selector-groups.ts`：`getForkProviderSelectorGroups` 改为**只返回 `renyimiao`（置顶）+ `normalTranslator`**（丢 `builtInModels` 藏免费AI、丢 `llmModels` 藏其它 LLM）
- [x] 1.3 更新 `__tests__/provider-selector-groups.test.ts`：断言只出 2 组、其它 LLM 与 system item 不出现
- [x] 1.4 核对上游 4 处调用方 props 契约对齐；确认无 named `getProviderSelectorGroups` 引入（fork 只需 default 导出，无需 re-export）

## 2. fork popup provider 块（加挂载 seed）

- [x] 2.1 `src/fork/ui/popup/providers-field.tsx`：summary + Drawer + 功能行 + 自定义动作行；不显 api-key 警告
- [x] 2.2 `src/fork/ui/popup/App.tsx`：import fork providers-field
- [x] 2.3 挂载时调用 `ensureRenyimiaoSeeded`（读 storage 最新值、幂等）

## 3. fork 选项页 provider 页（列表形态锁定）

- [x] 3.1 `src/fork/ui/options/providers-config.tsx`：导出 `ProvidersConfig`；保留列表(左栏)+编辑器布局，列表只任译喵、无「添加提供商」、无「内置提供商」区；右侧配 API Key（模型/baseURL 只读）；复用 ConfigCard/EntityEditorLayout/EntityListRail + base-ui，不 import 上游 `providers-config`/`ProviderConfigForm`
- [x] 3.2 挂载时调用 `ensureRenyimiaoSeeded`

## 4. seed 可靠化 + 词典 repoint（改 renyimiao / background）

- [x] 4.1 `src/fork/providers/renyimiao.ts`：`computeForkConfigSync` 改 **seed-only**（不再移除默认 provider）；新增 `ensureRenyimiaoSeeded`（读 storage、幂等补齐 + 把指向被藏 provider 的功能/自定义动作 repoint 到任译喵）
- [x] 4.2 更新 `renyimiao.test.ts`：seed-only 保留默认、词典/隐藏项 repoint 任译喵、幂等、不覆盖 apiKey
- [x] 4.3 `src/fork/background/index.ts`：移除 racy 的后台 config 同步（seed 已移 UI 挂载）

## 5. resolve 插件全局重定向（wxt.config）

- [x] 5.1 `wxt.config.ts`：自定义 Vite resolve 插件（`enforce:"pre"`），`this.resolve` 命中上游 `provider-selector.tsx`/`providers-config.tsx` 绝对路径 → 返回对应 fork 文件；相对 import 也拦
- [x] 5.2 验证重定向生效：产物 `api-providers` chunk 含 fork 选项页独有串、不含上游内置区；上游源文件零编辑

## 6. 门禁与验收

- [x] 6.1 `pnpm run type-check` 干净
- [x] 6.2 `SKIP_FREE_API=true pnpm run test` 全绿（1823 passed | 4 skipped）
- [x] 6.3 `pnpm run build` + `build:edge` + `build:firefox` 三目标通过
- [x] 6.4 `FORK_DIFF_BASE=origin/change/fork-foundation node scripts/check-fork-boundary.mjs` 通过（未编辑上游 composed UI 源文件）
- [x] 6.5 `node scripts/assert-fork-build.mjs` 通过
- [x] 6.6 `pnpm dev` 实测：全局选择器只任译喵+普通翻译；选项页只任译喵、无添加、无内置；全新 profile 可靠 seed；词典走任译喵（用户已验收）

## 7. 任译喵多实例 + 选项页收成单块 +「更新模型」动态同步（追加优化）

产品形态：底层每模型一份 openai-compatible 实例（共享网关 baseURL/apiKey）→ popup 平铺各模型、每功能可各选；选项页收成一个「任译喵 API」块管理（改 key 广播、点更新模型 fetch /models 重建实例集）。

- [x] 7.1 `renyimiao.ts`：**每模型一份实例**（`renyimiao-<modelId>`、name `任译喵 <modelId>`、共享 key）；新增 `syncRenyimiaoModels`（以 /models 结果为准重建实例集 + 移除模型时 repoint 到存活实例）、`renyimiaoApiKey`/`setRenyimiaoApiKey`（读/广播共享 key）、`renyimiaoModelIds`；`isVisibleProviderId` 改按实际存在判断（sync 移除实例后可正确 repoint）
- [x] 7.2 更新 `renyimiao.test.ts`（多实例 seed / sync 重建+repoint / key 广播）、`provider-selector-groups.test.ts`（多模型实例平铺进任译喵组）
- [x] 7.3 新增 `connection-test-button.tsx`：复刻陪读蛙连接检测（复用 `executeTranslate`+`getTranslatePrompt`，idle/testing/success/slow/failed），不引用上游 composed UI
- [x] 7.4 新增 `update-models-button.tsx`：复刻陪读蛙 /models 拉取（`fetch(${baseURL}/models, Bearer)` + `extractErrorMessage`），但整份回给选项页做实例集同步（非 Combobox 选一个）
- [x] 7.5 选项页 `providers-config.tsx`：单块「任译喵 API」——API Key（改→广播全部实例）+ 检测按钮（探首个实例）；「更新模型」按钮（fetch→syncRenyimiaoModels 重建实例）；模型清单只读展示；Base URL 只读；修掉重复名（ProviderIcon 已渲染 name、删多余 span）、移除冗余编辑器头部
- [x] 7.6 `provider-selector.tsx`：恢复 `getGroupedItemName`（任译喵组内剥「任译喵 」前缀，平铺展示模型名）
- [x] 7.7 门禁复验：type-check 干净、全量测试 1824 passed、chrome 构建通过、边界 OK、assert-fork-build OK、三 fork 串（选项页/更新模型/连接检测）均在 api-providers chunk
- [x] 7.8 `pnpm dev` 实测（用户已验收）：选项页单块「任译喵 API」名字不重复；popup 任译喵组平铺模型；连接检测按钮探测通；点「更新模型」拉网关 /models、模型清单更新为 6 个真实模型；每功能可选不同模型
