import type { CustomActionProviderRef } from "@/utils/providers/provider-registry"
import { resolveModelId } from "@/utils/providers/model-id"
import { getRecommendedProviderOptions } from "@/utils/providers/options"
import { isRenyimiaoInstance } from "./renyimiao"

// fork：词典（自定义结构化动作）在任译喵网关上的 response_format 降级。
// 上游对 openai-compatible 实例硬编码 supportsStructuredOutputs:true → 请求发 response_format:json_schema，
// 任译喵网关模型（deepseek-v4-flash）不认该强约束、报 "This response_format type is unavailable now"。
// 系统提示词本就内建「只返回一个 JSON 对象 + 精确 key 名」契约、引擎容错解析，故只需把请求降到网关支持的
// json_object（JSON mode）即可。这里只给词典执行链的「瞬时 provider 引用」注入 providerOptions.response_format——
// ref 不落 config，普通翻译走独立文本路径、不经此引用 → 翻译零影响。
//
// 必须不可变复制：ref.config 与 providersConfig atom 是同一对象引用，原地变异会污染共享对象、令翻译回归。
// recommended 由 model 泛化推导并先合入——getProviderOptionsWithOverride 在 userOptions 已定义时整体替换
// recommended（不合并），不先合入会丢掉 deepseek 的 thinking:{type:"disabled"}。
export function withRenyimiaoJsonObjectFormat(
  ref: CustomActionProviderRef | null,
): CustomActionProviderRef | null {
  if (ref?.kind !== "local" || !isRenyimiaoInstance(ref.config)) {
    return ref
  }

  const { config } = ref
  // 用户已设 providerOptions 优先，否则合入 model 的 recommended（如 deepseek 的 thinking:disabled），再叠 response_format。
  const baseOptions =
    config.providerOptions ??
    getRecommendedProviderOptions(resolveModelId(config.model) ?? "") ??
    {}

  return {
    ...ref,
    config: {
      ...config,
      providerOptions: { ...baseOptions, response_format: { type: "json_object" } },
    },
  }
}
