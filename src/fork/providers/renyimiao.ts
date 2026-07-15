import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
} from "@/utils/constants/feature-providers"
import { isSystemProviderId } from "@/utils/providers/provider-registry"

// 任译喵内置托管翻译：每个可用模型 seed 一个上游 openai-compatible 实例，作为一项出现在
// provider 选择器；同时隐藏 out-of-box 的第三方 LLM 默认 provider（产品只暴露任译喵 + 免费AI + 普通翻译）。
// 纯 config 数据操作，零改 provider schema。

export const RENYIMIAO_ID_PREFIX = "renyimiao-"

// oneapi 翻译网关地址：与 env.WXT_API_URL（better-auth 后端 api.translatebuff.com）不同域，
// 是独立的翻译网关服务，故存 fork 常量而非从 env 派生；此值不随 dev/preview/prod 环境切换。
export const RENYIMIAO_GATEWAY_BASE_URL = "https://open-ai.baomiao.cn/v1"

// 隐藏的上游默认 provider 实例（out-of-box 第三方 LLM）。仅移除默认 seed 的实例（`-default` id），
// 用户自行「添加提供商」的同类 provider（随机 UUID）不受影响。
export const HIDDEN_DEFAULT_PROVIDER_IDS: ReadonlySet<string> = new Set([
  "openai-default",
  "deepseek-default",
  "atlascloud-default",
])

// 移除 provider 后，原本指向它的功能兜底到这个保留的、免 key 的翻译源，避免 providerId 悬空导致解析抛错。
const FALLBACK_PROVIDER_ID = "microsoft-translate-default"

export interface RenyimiaoModel {
  /** 展示名（provider 选择器条目可见） */
  label: string
  /** 提交给网关的模型 id：大小写敏感，必须逐字匹配 oneapi 后台别名 */
  modelId: string
  /** 后台是否已配置可用；仅 available 的模型会 seed 出实例 */
  available: boolean
}

// 内置模型清单（硬编码、随发版可调）。后台配好新模型后，把对应项改 available:true 即会 seed 出条目。
export const RENYIMIAO_MODELS: readonly RenyimiaoModel[] = [
  { label: "DeepSeek-V4-Flash", modelId: "Deepseek-V4-Flash", available: true },
  { label: "GPT-5.5", modelId: "gpt-5.5", available: false },
  { label: "Qwen3.5 Plus", modelId: "qwen3.5-plus", available: false },
]

type RenyimiaoProviderConfig = Extract<ProviderConfig, { provider: "openai-compatible" }>

export function renyimiaoInstanceId(modelId: string): string {
  return `${RENYIMIAO_ID_PREFIX}${modelId}`
}

function isRenyimiaoInstance(provider: ProviderConfig): boolean {
  return provider.id.startsWith(RENYIMIAO_ID_PREFIX)
}

// 单个模型对应的 openai-compatible 实例。model.model 必须为字面量 "use-custom-model"
// （上游 openai-compatible 的必填枚举），否则整份 config zod 校验失败。
export function buildRenyimiaoProvider(model: RenyimiaoModel): RenyimiaoProviderConfig {
  return {
    id: renyimiaoInstanceId(model.modelId),
    name: `任译喵 ${model.label}`,
    enabled: true,
    provider: "openai-compatible",
    baseURL: RENYIMIAO_GATEWAY_BASE_URL,
    apiKey: "",
    model: {
      model: "use-custom-model",
      isCustomModel: true,
      customModel: model.modelId,
    },
  }
}

// 计算 fork 对 config 的同步补丁：
//   ① 为每个可用模型补齐任译喵实例（已存在的保留原样，不覆盖用户填的 apiKey）；
//   ② 移除隐藏的默认 LLM provider（OpenAI/DeepSeek/Atlas Cloud）与过期任译喵实例；
//   ③ 把因此悬空的功能 providerId 兜底到微软翻译（保留、免 key）。
// 无变化时返回 null（免写）。
export function computeForkConfigSync(config: Config): Partial<Config> | null {
  const { providersConfig } = config
  const desired = RENYIMIAO_MODELS.filter((model) => model.available).map(buildRenyimiaoProvider)
  const desiredIds = new Set(desired.map((provider) => provider.id))

  const kept = providersConfig.filter(
    (provider) =>
      !HIDDEN_DEFAULT_PROVIDER_IDS.has(provider.id) &&
      provider.provider !== "atlascloud" &&
      (!isRenyimiaoInstance(provider) || desiredIds.has(provider.id)),
  )
  const keptIds = new Set(kept.map((provider) => provider.id))
  const toAppend = desired.filter((provider) => !keptIds.has(provider.id))
  const nextProviders = [...kept, ...toAppend]
  const validLocalIds = new Set(nextProviders.map((provider) => provider.id))

  const providersChanged = kept.length !== providersConfig.length || toAppend.length > 0

  const reassignments: Partial<Record<FeatureKey, string>> = {}
  for (const featureKey of FEATURE_KEYS) {
    const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config)
    if (!validLocalIds.has(providerId) && !isSystemProviderId(providerId)) {
      reassignments[featureKey] = FALLBACK_PROVIDER_ID
    }
  }
  const reassigned = Object.keys(reassignments).length > 0

  if (!providersChanged && !reassigned) {
    return null
  }
  return { ...buildFeatureProviderPatch(reassignments), providersConfig: nextProviders }
}
