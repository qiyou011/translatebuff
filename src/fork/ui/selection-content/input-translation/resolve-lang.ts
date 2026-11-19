import type { Config } from "@/types/config/config"
import { getDetectedCodeFromStorage } from "@/utils/config/languages"
import { getEffectiveSiteRule } from "@/utils/site-rules/effective"
import { detectChatContextLanguage } from "./chat-context-language"
import { getChatContextSelector } from "./chat-context-sites"
import { getTelegramContext } from "./telegram-context"

async function resolveInputSourceLanguage(config: Config, url: string, editor: HTMLElement) {
  const source = config.inputTranslation.fromLang
  if (source === "targetCode") return config.language.targetCode
  if (source !== "sourceCode") return source
  if (config.language.sourceCode !== "auto") return config.language.sourceCode

  const telegram = getTelegramContext(url, editor)
  const chatSelector = getChatContextSelector(url)
  if (chatSelector || telegram) {
    const chatCode = await detectChatContextLanguage(editor.ownerDocument, {
      chatSelector,
      messages: telegram?.messages,
      excludeSelector: getEffectiveSiteRule(config, url).excludeSelector,
    })
    if (chatCode) return chatCode
  }
  return getDetectedCodeFromStorage()
}

/** 恢复旧版源语言取值，目标仍使用输入翻译独立保存的语言。 */
export async function resolveInputTranslationLang(
  config: Config,
  url: string,
  editor: HTMLElement,
) {
  const target = config.inputTranslation.toLang
  if (target === "sourceCode" || target === "targetCode") {
    throw new Error("Input target has not been migrated")
  }
  const source = await resolveInputSourceLanguage(config, url, editor)
  return {
    from: { code: source },
    to: { code: target, source: "configured" as const },
  }
}
