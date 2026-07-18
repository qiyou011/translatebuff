import type { Config } from "@/types/config/config"
import { computeForkConfigSync, setRenyimiaoApiKey } from "@/fork/providers/renyimiao"

// 登录后把 sk_key 单写进任译喵 provider 的纯计算。
// 「读一次 config → seed 实例（幂等）→ 对全部任译喵实例写同一 key」得出补丁，后台据此一次 storageAdapter 写回。
// 本迭代只写 apiKey，不写 base_url（实例 baseURL 维持网关常量；base_url SSOT 留到翻译调用迭代）。
export function computeLoginConfigPatch(config: Config, skKey: string): Partial<Config> {
  const seedPatch = computeForkConfigSync(config) ?? {}
  const seededProviders = seedPatch.providersConfig ?? config.providersConfig
  return { ...seedPatch, providersConfig: setRenyimiaoApiKey(seededProviders, skKey) }
}

// 登出 / 凭据失效清 key：把全部任译喵实例 apiKey 清空。
export function computeLogoutConfigPatch(config: Config): Partial<Config> {
  return { providersConfig: setRenyimiaoApiKey(config.providersConfig, "") }
}
