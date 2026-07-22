# fork-selection-toolbar-shell 复盘

> 由 jyopsx-retro 于 2026-07-22 生成。TAVS 四阶段完成后、归档前的复盘沉淀。

## 背景与目标

翻译浮窗（`selection.content`）此前靠「在共享 `app.tsx` 原地改 + 逐个 redirect 隐藏上游功能」维持。最近一次同步上游（PR #7）在 `app.tsx` / toast 上正面冲突（fork 曾改名共享组件 `frog-toast`→`brand-toast`，上游 #1889 又把 frog-toast 换成 base-ui toast），暴露了软 fork 的结构弱点：**重度定制的整块 surface 不该原地改、逐块 redirect**。同时 notebase / 猜你想存靠 redirect 只藏了视觉——后台 `useSaveSuggestion` 的 AI 请求仍在跑、白耗配额。

目标：把翻译浮窗升级为「re-export shim + fork 壳」（对齐 popup 已验证模式），fork 拥有 UI 组合、复用上游翻译引擎与机制，彻底省略 notebase / 猜你想存，为后续 UI 重设计铺路。本次只复刻现状 UI，不重设计。

## 遇到的问题及挑战

### 1. module-private context 逼出「整块 Provider fork」（探索期识别，避免了实现返工）

最初设想能用「薄 context 转发」低成本接管 UI。探索时发现上游 `SelectionTranslationContext`（`translate-button/provider.tsx:238-242`）是**未导出的 module-private const**，只暴露 `{ prepareToolbarOpen }`；13 个翻译态是 Provider 内 `useState`、popover JSX 在 Provider 内层直接消费本地 state。→ **要写自己的 popover JSX 就必须 fork 整个 Provider**（薄 context 方案不可行）。这条约束在 explore 阶段的 architect-review 卡点识别，直接决定了 D2/D3/D4 架构，没有拖到实现期才发现。

### 2. D4 三元组绑定：编译期抓不到的运行时崩风险

fork 自建 context 后，若某触发按钮仍 import 上游按钮（读上游 module-private context），运行时抛 `"must be used within Provider"`——**TypeScript 编译期无法捕获**。应对：把「Provider + Toolbar + 触发按钮」定为**三元组同进同出**不变量（D4），用源级不变量测试②（TDD 红→绿：`SelectionToolbar`/`TranslateButton`/`CustomActionTrigger` 必须引用 fork context 且不 import 上游 provider）+ 壳文件头注释兜底。

### 3. 词典报错「response_format unavailable」——疑似 fork 回归，实为后端限制（最大的坑）

实机验证时，自定义动作「词典」报 `This response_format type is unavailable now`。第一反应是 fork 复刻漏了什么。用 systematic-debugging 定位：fork controller 与上游 **identically** 调用 `useCustomActionExecution` / `buildCustomActionExecutionPlan`，同样的错误在上游也会复现 → 根因是**任译喵网关模型 deepseek-v4 不支持 json_schema response_format**（结构化输出），非 fork bug。教训：复刻壳出问题时，先核对「上游同路径是否也会挂」再判定归属，避免误挖 fork。

### 4. 验证期两类「假失败」干扰判定

- **`.env` 覆盖 `WXT_WEBSITE_URL`**：本地 `.env` 把 website URL 指向 localhost，全量套件挂 8 个上游 guide 测试（FORK_GUIDE §8 已记）。移开 `.env` 后降到 4 个。
- **满载机器 flaky 超时**：移开 `.env` 后残留的 4 个失败全是 `Test timed out in 5000ms`，分布在与本变更**完全无关**的文件（config / context-menu / subtitles / providers），单测各耗 5–12s——全量套件在高负载下（本次 import 累计 1082s、总时长 253s）的超时抖动。定向隔离重跑这 4 个文件 **26/26 全过（3.95s）**，坐实非回归。
- 教训：验证软 fork 改动时，全量套件的失败要**逐条归因**（`.env` / 负载抖动 / 真回归），别被总数吓退；优先定向跑改动相关文件（1.5s）确认，全量放后台。

### 5. redesign 越出 Non-Goal，提交期需二次分离

本变更 D7 明写「不重设计 UI」，但为绕开 #3 的词典报错，实机后把药丸里的词典入口换成了设置齿轮（跳选项页）。该 redesign 落在同一新文件 `SelectionToolbar.tsx` 里，与复刻**无法按文件分离**（新文件不能 `git add -p` 部分暂存）。提交时用「还原齿轮 → 提交复刻 → 重贴齿轮 → 提交 redesign」两步分离，产出两个独立 commit（`3a8108bf` 复刻壳 / `666ef371` 词典→齿轮），保住复刻变更「MUST NOT 重设计」的纯净。

### 6. commitlint 卡提交

复刻 commit 首条 bullet 超 100 字符行限（`body-max-line-length`），被 husky 拒。缩短 bullet 后过。（历史反复踩：subject 不能大写/PascalCase 开头。）

## 架构/设计偏离说明

- **redesign 越出 D7 Non-Goal**：词典→齿轮是本变更范围外的 redesign，通过独立 commit 隔离，未污染复刻变更。后续若正式立项应另开 `fork-selection-toolbar-redesign`。
- **药丸 inline 了上游 `SelectionToolbarCustomActionButtons` 的过滤**：design 表述药丸「import 上游机制、重写 JSX」，实现时把上游那个 composed 组件的 `enabled !== false` 过滤 inline 进 `enabledCustomActions.map`，而非 import 它——合理（少一层上游 composed UI 依赖，符合 fork「换皮」原则），轻微偏离已合理化保留。
- **fork 特例分支嵌进镜像文件**：`action.id === "default-dictionary"` 三元判定内联在镜像文件 `SelectionToolbar.tsx` 的 map 体里。Simplify 高度审查提示：这把 fork 特例摊进了同步 diff 面，redesign 累积时应上提到 fork 壳层 helper（如 `renderActionOrGear`）保持镜像 map 纯净。本次 3 行内联短、可读，留存，记为模式提醒。

## 总结与后续优化点

- **「re-export shim + fork 壳」模式已在第二个 surface（popup 之后是翻译浮窗）验证**：抗上游冲突（本次仅碰 2 个 allowlist 文件 + wxt.config，净新增全在 `src/fork/ui/selection-content/**`）+ 干净隐藏（不渲染 + 不 import hook，连 `streamNoteSuggestion` AI 请求都不发，比 redirect 空组件彻底）。
- **同步 diff 清单已在 design Risks 记全**：上游 `translate-button/provider.tsx` + `custom-action-button/provider.tsx` + `selection-toolbar/index.tsx` + `selection.content/app.tsx`。下次上游同步须按此清单逐一 diff、把 delta 搬进镜像 controller/Toolbar——这是深层 fork 的固有维护成本。
- **后续 redesign 隔离**：redesign 该单独立项，避免与复刻混在同一工作会话（省掉「还原→提交→重贴」摩擦）；若 redesign 累积，把「动作→组件」映射上提到 fork helper，保护同步 diff 面（对齐 D3 两层拆分初衷）。
- **后端跟进（研发/后端团队）**：任译喵网关 deepseek-v4 不支持 json_schema response_format → 词典等结构化自定义动作会挂。要么后端支持结构化输出，要么产品侧明确不提供这类动作。`.env.production` 的 `WXT_RENYIMIAO_API_URL` / `WXT_RENYIMIAO_GATEWAY_URL` 仍是占位，上线前 ops 须填。
