## Context

任译喵是 read-frog 的软 fork。「词典」不是独立功能，而是上游「自定义 AI 动作」的内置模板 `default-dictionary`（书本图标，输出词条 / 音标 / 词性 / 释义 / 段落 / 段落翻译 / 难度 共 7 个结构化字段），走通用的自定义动作机制，无专属代码路径。

**当前状态与根因**：

- fork 翻译浮窗壳 `src/fork/ui/selection-content/SelectionToolbar.tsx:540-547` 用三元把 `default-dictionary` 按钮换成设置齿轮（`SettingsButton.tsx`，点击打开选项页），词典点不出。
- 词典执行走「本地 `streamText({ output: Output.object({schema}) })`」分支（`background-stream.ts:586` `createLocalStructuredObjectPartStream`），判据是 `isBuiltInAiProviderId(providerId)` 为假——任译喵实例 id 前缀 `renyimiao-` ≠ 内置免费 AI 的 `read-frog-free-ai`，故不走 hosted oRPC 分支。
- 上游 `model.ts:108` 对所有自定义 LLM provider 硬编码 `supportsStructuredOutputs: true`，导致 openai-compatible 请求发 `response_format: { type: "json_schema" }`；任译喵网关模型 deepseek-v4-flash 不认，报 `This response_format type is unavailable now`。
- 系统提示词已内建「只返回一个 JSON 对象 + 精确 key 名」的 Structured Output Contract（`custom-action-prompt.ts:66-98`），引擎也带容错解析（`parsePartialJson` + zod `strictObject.parse`）——所以词典本不依赖 `json_schema` 强约束，只要请求改发网关支持的 `json_object`（JSON mode）即可正常解析。

**软 fork 约束**：A 类文件（`model.ts` / `background-stream.ts` / config zod schema / migration）绝不改；净新增 / 改动全进 `src/fork/**`（C 类）；避免动 `scripts/fork-allowlist.json`。本变更目标零 allowlist。

## Goals / Non-Goals

**Goals:**

- 词典在任译喵网关模型上真正可用（返回 7 字段结构化结果）。
- 悬浮工具栏词典按钮回归、临时齿轮移除。
- `response_format` 降级**只作用于词典（结构化动作）执行链**，普通翻译零影响。
- 全部落在 `src/fork/**`，零 allowlist，不碰上游引擎与 config schema。

**Non-Goals:**

- 不改词典模板、7 个输出字段、系统提示词。
- 不改上游 `model.ts` / `background-stream.ts` / config schema / migration / `providers.ts` / `models.ts`。
- 不做词典或工具栏的视觉重设计（本变更无视觉量纲）。
- 不用「后台全局 `fetch` 拦截」方案（候选 B，见 Decisions 弃因）。
- 不触碰内置免费 AI（`read-frog-free-ai`）的 hosted oRPC 结构化路径。

## Decisions

### D1 · 降级切入层：fork 词典执行链的「瞬时 provider 引用」注入（方案 A′）

**做法**：fork 词典 controller（`use-custom-action-controller.ts`）在自己构造 provider 引用后、传入 `buildCustomActionExecutionPlan` 之前，把该引用过一层 fork helper。helper 造一个 `providerOptions` 含 `response_format: { type: "json_object" }` 的**新引用（瞬时内存对象，不落 config / atoms）**。上游 `buildCustomActionExecutionRequest`（`use-custom-action-execution.ts:235`）从这个引用读 `config.providerOptions`，经 `getProviderOptionsWithOverride` 透传至 `streamText`；`@ai-sdk/openai-compatible` 的 `getArgs` 把未知键 `response_format` spread 进请求体、覆盖默认的 `json_schema`。

**为什么选 A′，不选另两条**：

| 方案                                                                               | 弃/取  | 理由                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 给 `buildRenyimiaoProvider` 的 provider config 挂 `providerOptions`（config 全局） | **弃** | 翻译（整页 `ai.ts` / 划词 / 语言检测 / 摘要 / 分段）读**同一个** config.providerOptions，会被 `json_object` 无条件污染 → 译文损坏 / 网关报错。架构审查判为阻断。   |
| 后台全局 `globalThis.fetch` 拦截改写请求体（候选 B）                               | **弃** | 能做到纯 C 类，但把局部问题上升成「后台全局 fetch 猴补丁 + 绑死 SDK body 形态 + 动态网关 URL 双条件判定」，爆炸半径覆盖所有后台 I/O，脆弱面显著更大。              |
| **A′：词典执行链瞬时 ref 注入**                                                    | **取** | 只作用词典执行链、ref 不落 config → 翻译一行碰不到；纯 C 类零 allowlist；依赖的是 openai-compatible **对外的 `providerOptions` 穿透扩展点**，比 fetch 内部实现稳。 |

### D2 · 词典入口回归 + 齿轮移除

删 `SelectionToolbar.tsx:540-547` 的 `default-dictionary` 三元拦截，统一走 `<CustomActionTrigger action={action} />`；删该文件对 `SelectionToolbarSettingsButton` 的 import；删除齿轮组件文件 `SettingsButton.tsx`（撤引用后无人使用，齿轮产品决策已被推翻）。→ 工具栏回到上游原生形态：translate / speak / 📖词典 / close。

### D3 · 降级形状与 recommended 合并（必须正确，否则功能不生效 / 行为回归）

- `config.providerOptions` 是**内层单层**形状（schema `providerOptions: z.record(z.string(), z.any()).optional()`）。下游 `getProviderOptionsWithOverride` 会用 `{ [provider]: … }` 再包一层——故 helper 写内层 `{ ...inner, response_format }`，**不可**写成 `{ "openai-compatible": {...} }`（会被二次包裹、降级失效）。
- `getProviderOptionsWithOverride` 在 userOptions defined 时**整体替换** recommended（不合并）。故 helper 必须**先合入 recommended** 再叠 `response_format`，否则丢掉 deepseek-v4-flash 的 `thinking: { type: "disabled" }`。用 `getRecommendedProviderOptions(resolveModelId(config.model))` 泛化推导，换模型（GPT-5.5 / qwen 等）自动正确，不硬编码。

### D4 · 不可变复制（护栏，违反即重演 D1 翻译回归）

`resolveProviderRefForCapability` 返回的 `config` 是 `providersConfig` atom 里**同一对象引用**（未克隆）。helper **MUST** 返回新 ref + 新 config 对象（`{ ...ref, config: { ...ref.config, providerOptions: merged } }`），**绝不**原地写 `ref.config.providerOptions = …`——否则污染共享对象，翻译读同一引用即回归。以单测断言「调用后原 `providersConfig` 未被改」锁死。

## 文件结构

| 操作 | 文件                                                                 | 职责（单一）                                                               |
| ---- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A    | `src/fork/providers/custom-action-response-format.ts`                | 纯函数 helper：给任译喵词典 provider 引用注入 `json_object` 降级，其余原样 |
| A    | `src/fork/providers/__tests__/custom-action-response-format.test.ts` | helper 单测（注入 / recommended 合入 / 不可变 / 豁免）                     |
| M    | `src/fork/ui/selection-content/use-custom-action-controller.ts`      | 1 处：resolve 出的 provider 引用过 helper 再传执行计划                     |
| M    | `src/fork/ui/selection-content/SelectionToolbar.tsx`                 | 删 `default-dictionary` 三元拦截 + 删齿轮 import                           |
| D    | `src/fork/ui/selection-content/SettingsButton.tsx`                   | 删齿轮组件（死代码）                                                       |
| M    | `src/fork/ui/selection-content/__tests__/shell-invariants.test.ts`   | 补防齿轮回归断言                                                           |

## 接口契约

```ts
// src/fork/providers/custom-action-response-format.ts
// Consumes: 上游 getRecommendedProviderOptions(src/utils/providers/options.ts)、resolveModelId(model-id.ts)；
//           fork isRenyimiaoInstance(src/fork/providers/renyimiao.ts)
// Produces: 供 use-custom-action-controller 调用的 helper

// ref 类型为 resolveProviderRefForCapability 的返回类型（provider-registry 的 ProviderRef，
// 含 kind: "local" | "system" 与 config: ProviderConfig）。apply 时以其真实类型为准。
export function withRenyimiaoJsonObjectFormat<T extends ProviderRef>(ref: T): T
//   ref.kind !== "local" 或 !isRenyimiaoInstance(ref.config) → 原样返回 ref
//   否则 → 返回 { ...ref, config: { ...ref.config, providerOptions: merged } }
//   其中 merged = {
//     ...(ref.config.providerOptions ?? getRecommendedProviderOptions(resolveModelId(ref.config.model)) ?? {}),
//     response_format: { type: "json_object" },
//   }
```

接入点（`use-custom-action-controller.ts`，构造 `customActionRequest.provider` 处）：

```ts
// 原：const provider = resolveProviderRefForCapability(...)
// 改：const provider = withRenyimiaoJsonObjectFormat(resolveProviderRefForCapability(...))
```

## Risks / Trade-offs

- **依赖 AI SDK 内部行为**：A′ 靠 `@ai-sdk/openai-compatible` 的 `getArgs` 把 `providerOptions` 未知键 spread 进请求体、且 spread 在默认 `response_format` 之后（后写覆盖）。这是包内部实现（v3.0.12 已逐行核对成立），非公开契约。
  - 缓解：版本由 `pnpm-lock.yaml` 锁定（当前 `@ai-sdk/openai-compatible@3.0.12`）；补一条**集成断言**「词典执行构建出的出站参数 `response_format` 为 `json_object`」，而非只断言 config 字段存在——SDK 升级导致穿透失效时该断言在 CI 挂、提示复核。
- **不可变护栏**：见 D4，helper 原地变异会重演翻译污染——由单测锁死。
- **降级作用面**：`json_object` 降级作用于所有任译喵结构化动作执行；当前唯一实例是词典，普通翻译走独立文本路径不受影响，属预期。
- **回滚**：本变更纯 fork 层、纯增量；如需回退，恢复 `SelectionToolbar.tsx` 三元拦截 + 撤 helper 接入即可，无数据 / 配置迁移。

## Open Questions

无。技术可行性与副作用面已由两轮架构审查闭合（A′ 复审「审查通过」）。
