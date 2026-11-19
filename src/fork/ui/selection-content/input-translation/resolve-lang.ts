import type { Config, InputTranslationLang } from "@/types/config/config"
import { getDetectedCodeFromStorage } from "@/utils/config/languages"
import { getEffectiveSiteRule } from "@/utils/site-rules/effective"
import { detectChatContextLanguage } from "./chat-context-language"
import { getChatContextSelector } from "./chat-context-sites"
import { getTelegramContext } from "./telegram-context"

export async function resolveInputTranslationLang(
  language: InputTranslationLang,
  config: Config,
  url: string,
  editor: HTMLElement,
) {
  if (language === "targetCode") return config.language.targetCode
  if (language !== "sourceCode") return language
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
