import type { Config } from "@/types/config/config"
import type { ProviderConfig, ProvidersConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import { FORK_BRANDING } from "@/fork/branding"
import { configSchema } from "@/types/config/config"
import { isPureTranslateProviderConfig } from "@/types/config/provider"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
} from "@/utils/constants/feature-providers"

// 任译喵内置托管翻译：每个模型一份 openai-compatible 实例（共享网关 baseURL + API Key）。
// 选项页把它们收成一个「任译喵 API」块管理（改 key 广播、点「更新模型」fetch /models 重建实例集）；
// popup 选择器平铺各模型、每功能可各选。隐藏其它 provider 由 UI 层负责；config 层只 seed + repoint，
// 不移除默认 provider（避开上游 initializeConfig 新装竞态）。纯 config 数据操作，零改 schema。

export const RENYIMIAO_ID_PREFIX = "renyimiao-"

// oneapi 翻译网关地址：与 env.WXT_API_URL（better-auth 后端）不同域，是独立翻译网关。
// 作为「登录前默认 / base_url 缺失回落」的占位常量——登录后由 /v1/tokens 返回的动态 base_url 覆盖。
export const RENYIMIAO_GATEWAY_BASE_URL = "https://open-ai.baomiao.cn/v1"

// 网关 base_url 归一：去尾斜杠 + 幂等补 /v1（openai 兼容端点约定）。空串回落网关常量。
// /v1/tokens 返回的 base_url 可能不含 /v1；实例 baseURL 统一存含 /v1 形态，拉 /models 时直接补 /models。
export function normalizeGatewayBaseUrl(baseUrl: string): string {
  if (baseUrl === "") {
    return RENYIMIAO_GATEWAY_BASE_URL
  }
  const trimmed = baseUrl.replace(/\/+$/, "")
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`
}

export interface RenyimiaoModel {
  /** 提交给网关的模型 id：大小写敏感，逐字匹配 oneapi 后台别名 */
  modelId: string
  /** 后台是否已配置可用；仅 available 的模型会在新装时 seed */
  available: boolean
}

// 内置默认模型：仅用于新装初始 seed（保证装完即可用 + repoint 有目标）。真实清单由选项页「更新模型」fetch /models。
export const RENYIMIAO_MODELS: readonly RenyimiaoModel[] = [
  { modelId: "Deepseek-V4-Flash", available: true },
  { modelId: "GPT-5.5", available: false },
  { modelId: "qwen3.5-plus", available: false },
]

export type RenyimiaoProviderConfig = Extract<ProviderConfig, { provider: "openai-compatible" }>

export function renyimiaoInstanceId(modelId: string): string {
  return `${RENYIMIAO_ID_PREFIX}${modelId}`
}

// 任译喵实例识别谓词（按 id 前缀）。fork 各处共用。
export function isRenyimiaoInstance(provider: { id: string }): boolean {
  return provider.id.startsWith(RENYIMIAO_ID_PREFIX)
}

function isRenyimiaoProviderConfig(provider: ProviderConfig): provider is RenyimiaoProviderConfig {
  return isRenyimiaoInstance(provider) && provider.provider === "openai-compatible"
}

// 某模型对应的实例。model.model 必须为字面量 "use-custom-model"（openai-compatible 必填枚举），
// 真实模型 id 存 model.customModel。apiKey / baseURL 共享（同一网关同一登录 key）；
// baseURL 默认网关常量，登录后由调用方传入 /v1/tokens 的动态 base_url。
export function buildRenyimiaoProvider(
  modelId: string,
  apiKey = "",
  baseURL: string = RENYIMIAO_GATEWAY_BASE_URL,
): RenyimiaoProviderConfig {
  return {
    id: renyimiaoInstanceId(modelId),
    name: `${FORK_BRANDING.displayName} ${modelId}`,
    enabled: true,
    provider: "openai-compatible",
    baseURL,
    apiKey,
    model: {
      model: "use-custom-model",
      isCustomModel: true,
      customModel: modelId,
    },
  }
}

// 当前已同步的任译喵模型 id 列表（供选项页展示）。
export function renyimiaoModelIds(providersConfig: ProvidersConfig): string[] {
  return providersConfig
    .filter(isRenyimiaoProviderConfig)
    .map((provider) => provider.model.customModel ?? "")
    .filter((modelId) => modelId !== "")
}

// 共享 API Key：读首个任译喵实例的 key。
export function renyimiaoApiKey(providersConfig: ProvidersConfig): string {
  return providersConfig.find(isRenyimiaoProviderConfig)?.apiKey ?? ""
}

// 广播 API Key：写进全部任译喵实例，非任译喵 provider 不动。返回新 providersConfig。
export function setRenyimiaoApiKey(
  providersConfig: ProvidersConfig,
  apiKey: string,
): ProvidersConfig {
  return providersConfig.map((provider) =>
    isRenyimiaoProviderConfig(provider) ? { ...provider, apiKey } : provider,
  )
}

// 共享网关 base_url：读首个任译喵实例的 baseURL（同网关共享）。无实例 → 空串。
export function renyimiaoBaseUrl(providersConfig: ProvidersConfig): string {
  return providersConfig.find(isRenyimiaoProviderConfig)?.baseURL ?? ""
}

// 广播网关 base_url（归一到含 /v1）：写进全部任译喵实例，非任译喵 provider 不动。返回新 providersConfig。
export function setRenyimiaoBaseUrl(
  providersConfig: ProvidersConfig,
  baseUrl: string,
): ProvidersConfig {
  const normalized = normalizeGatewayBaseUrl(baseUrl)
  return providersConfig.map((provider) =>
    isRenyimiaoProviderConfig(provider) ? { ...provider, baseURL: normalized } : provider,
  )
}

// fork UI 可见性谓词：任译喵实例 或 纯翻译 provider（microsoft/google/deepl(x)）。
// 其余（默认 OpenAI/DeepSeek/Atlas 等 LLM、免费AI）在各 fork UI 面判为隐藏。
// 选择器分组、translation-hub 面板 / 下拉、repoint 判定共用同一条可见性定义。
export function isForkVisibleProvider(provider: ProviderConfig): boolean {
  return isRenyimiaoInstance(provider) || isPureTranslateProviderConfig(provider)
}

// 某 providerId 是否可见：存在于 config 且 fork 可见。
// 用"实际存在"判断（而非仅前缀），使 seed 与 sync 都能把指向已移除实例的功能识别为需 repoint。
function isVisibleProviderId(providerId: string, providersConfig: ProvidersConfig): boolean {
  const provider = providersConfig.find((item) => item.id === providerId)
  return provider ? isForkVisibleProvider(provider) : false
}

interface RepointResult {
  reassignments: Partial<Record<FeatureKey, string>>
  nextCustomActions: Config["selectionToolbar"]["customActions"]
  customActionsChanged: boolean
}

// 把指向"在 nextProviders 里不可见"的功能 / 自定义动作 repoint 到 fallbackId（存活的任译喵实例）。
function repointHidden(
  config: Config,
  nextProviders: ProvidersConfig,
  fallbackId: string,
): RepointResult {
  const reassignments: Partial<Record<FeatureKey, string>> = {}
  for (const featureKey of FEATURE_KEYS) {
    const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config)
    if (!isVisibleProviderId(providerId, nextProviders)) {
      reassignments[featureKey] = fallbackId
    }
  }

  let customActionsChanged = false
  const nextCustomActions = config.selectionToolbar.customActions.map((action) => {
    if (action.enabled !== false && !isVisibleProviderId(action.providerId, nextProviders)) {
      customActionsChanged = true
      return { ...action, providerId: fallbackId }
    }
    return action
  })

  return { reassignments, nextCustomActions, customActionsChanged }
}

function buildRepointPatch(
  config: Config,
  { reassignments, nextCustomActions, customActionsChanged }: RepointResult,
): Partial<Config> {
  const patch: Partial<Config> = { ...buildFeatureProviderPatch(reassignments) }
  if (customActionsChanged) {
    patch.selectionToolbar = { ...config.selectionToolbar, customActions: nextCustomActions }
  }
  return patch
}

// 计算 fork 对 config 的 seed 补丁（seed-only）：
//   ① 补齐内置可用模型的任译喵实例（已存在的保留原样，不覆盖 apiKey）；默认 provider 保留（UI 层隐藏）。
//   ② 把指向"被 UI 隐藏 provider"（其它 LLM / 免费AI，如默认「词典」）的功能与自定义动作 repoint 到任译喵实例。
// 无变化返回 null（免写）。
export function computeForkConfigSync(config: Config): Partial<Config> | null {
  const { providersConfig } = config
  const sharedKey = renyimiaoApiKey(providersConfig)
  const sharedBaseUrl = renyimiaoBaseUrl(providersConfig) || RENYIMIAO_GATEWAY_BASE_URL
  // 静态模型仅作「首装兜底」：当前无任何任译喵实例时才补齐可用模型（装完即可用 + repoint 有目标）。
  // 一旦已 seed 过或 /v1/models 动态同步过（已有实例），绝不再补静态——否则会把动态列表移除的静态模型加回、污染真实清单。
  const toAppend = providersConfig.some(isRenyimiaoInstance)
    ? []
    : RENYIMIAO_MODELS.filter((model) => model.available).map((model) =>
        buildRenyimiaoProvider(model.modelId, sharedKey, sharedBaseUrl),
      )
  const hasNewProviders = toAppend.length > 0
  const nextProviders = hasNewProviders ? [...providersConfig, ...toAppend] : providersConfig

  const fallbackId = nextProviders.find(isRenyimiaoInstance)?.id
  if (!fallbackId) {
    return null
  }

  const repoint = repointHidden(config, nextProviders, fallbackId)
  const featureChanged = Object.keys(repoint.reassignments).length > 0
  if (!hasNewProviders && !featureChanged && !repoint.customActionsChanged) {
    return null
  }

  const patch = buildRepointPatch(config, repoint)
  if (hasNewProviders) {
    patch.providersConfig = nextProviders
  }
  return patch
}

// 以「更新模型」fetch 的结果为准重建任译喵实例集：
//   已有同名模型的实例保留（含其 apiKey）、新模型按共享 key 新建、fetch 里没有的模型移除；
//   指向被移除实例的功能 / 自定义动作 repoint 到存活实例。空列表不清空（防误清）。返回补丁。
export function syncRenyimiaoModels(config: Config, modelIds: string[]): Partial<Config> {
  if (modelIds.length === 0) {
    return {}
  }
  const sharedKey = renyimiaoApiKey(config.providersConfig)
  const sharedBaseUrl = renyimiaoBaseUrl(config.providersConfig) || RENYIMIAO_GATEWAY_BASE_URL
  const existingById = new Map(
    config.providersConfig
      .filter(isRenyimiaoProviderConfig)
      .map((provider) => [provider.id, provider]),
  )
  const nonRenyimiao = config.providersConfig.filter((provider) => !isRenyimiaoInstance(provider))
  const desired = modelIds.map(
    (modelId) =>
      existingById.get(renyimiaoInstanceId(modelId)) ??
      buildRenyimiaoProvider(modelId, sharedKey, sharedBaseUrl),
  )
  const nextProviders = [...nonRenyimiao, ...desired]

  const repoint = repointHidden(config, nextProviders, renyimiaoInstanceId(modelIds[0]))
  const patch = buildRepointPatch(config, repoint)
  patch.providersConfig = nextProviders
  return patch
}

// UI 挂载时调用：从 storage 读最新 config（post-init，避开新装竞态）、算 seed 补丁、有变化则写回。幂等。
export async function ensureRenyimiaoSeeded(
  setConfig: (patch: Partial<Config>) => void | Promise<void>,
): Promise<void> {
  const config = await storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
  const patch = computeForkConfigSync(config)
  if (patch) {
    await setConfig(patch)
  }
}
