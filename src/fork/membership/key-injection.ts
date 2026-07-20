import type { Config } from "@/types/config/config"
import {
  computeForkConfigSync,
  setRenyimiaoApiKey,
  setRenyimiaoBaseUrl,
} from "@/fork/providers/renyimiao"

// 登录后把 sk_key + 动态 base_url 单写进任译喵 provider 的纯计算。
// 「读一次 config → seed 实例（幂等）→ 对全部任译喵实例写同一 key 与 base_url」得出补丁，后台据此一次写回。
// base_url 来自 /v1/tokens（与 sk_key 同源、SSOT）；空串由 setRenyimiaoBaseUrl 归一时回落网关常量。
export function computeLoginConfigPatch(
  config: Config,
  skKey: string,
  baseUrl: string,
): Partial<Config> {
  const seedPatch = computeForkConfigSync(config) ?? {}
  const seededProviders = seedPatch.providersConfig ?? config.providersConfig
  const withKey = setRenyimiaoApiKey(seededProviders, skKey)
  return { ...seedPatch, providersConfig: setRenyimiaoBaseUrl(withKey, baseUrl) }
}

// 登出 / 凭据失效清 key：把全部任译喵实例 apiKey 清空。
export function computeLogoutConfigPatch(config: Config): Partial<Config> {
  return { providersConfig: setRenyimiaoApiKey(config.providersConfig, "") }
}
