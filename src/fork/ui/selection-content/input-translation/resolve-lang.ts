import type { Config } from "@/types/config/config"
import { detectLanguage } from "@/utils/content/language"

/** 源语言只检测当前草稿，聊天/网页只能提供上下文，不能改变翻译方向。 */
export async function resolveInputTranslationLang(draft: string, config: Config) {
  const target = config.inputTranslation.toLang
  if (target === "sourceCode" || target === "targetCode") {
    throw new Error("Input target has not been migrated")
  }
  const source = await detectLanguage(draft, { enableLLM: false })
  if (!source) throw new Error("INPUT_LANGUAGE_UNDETECTED")
  return {
    from: { code: source, source: "draft" as const },
    to: { code: target, source: "configured" as const },
  }
}
