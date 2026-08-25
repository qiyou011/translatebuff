import type { Config } from "@/types/config/config"
import { resolveProviderConfigOrNull } from "@/utils/constants/feature-providers"

/**
 * 微软的免鉴权翻译端点没有保留标记的模式，而 translationOnly 页面模式经 innerHTML
 * 重渲染 provider 输出，二者组合必然损坏页面（详见 fork/providers/microsoft-translate.ts）。
 * 这里不做事后补救，而是从源头阻断这个组合的形成：provider 选择器在仅译文模式下把微软
 * 置灰，模式控件在微软激活时拒绝进入仅译文，读时归一化纠正存量配置。
 */
export function providerSupportsTranslationOnlyMode(provider: string): boolean {
  return provider !== "microsoft-translate"
}

/** 网页翻译当前 provider 是否允许进入 translationOnly 模式。 */
export function canEnterTranslationOnlyMode(config: Config): boolean {
  // featureKey 是 fork 的 "translate"——上游最新版已改名为 "pageTranslation"，别照抄。
  const providerConfig = resolveProviderConfigOrNull(config, "translate")
  return providerConfig === null || providerSupportsTranslationOnlyMode(providerConfig.provider)
}
