import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config, InputTranslationLang } from "@/types/config/config"
import { getDetectedCodeFromStorage, getFinalSourceCode } from "@/utils/config/languages"
import { getEffectiveSiteRule } from "@/utils/site-rules/effective"
import { detectChatContextLanguage } from "./chat-context-language"
import { getChatContextSelector } from "./chat-context-sites"

/**
 * 这个语言码是怎么定下来的。界面据此区分「自动检测」与「按网页源语言」——用户看得见
 * 检测有没有真的生效，才有的放矢地手动纠正。
 */
export type InputTranslationLangSource = "chatContext" | "pageSource" | "explicit"

export interface ResolvedInputTranslationLang {
  code: LangCodeISO6393
  source: InputTranslationLangSource
}

/**
 * 把输入翻译的语言选项解析成具体语言码。
 *
 * 解析刻意留在调用层而不是翻译引擎里：调用层本就持有语言决策（`enableCycle` 的方向互换
 * 就在那儿做），而引擎 `translateTextForInput` 本来就接受具体语言码。这样引擎一行不改，
 * 界面也能顺手拿到 `source`。
 *
 * 「网页源语言」在声明了对话选择器的站点上改看对话本身——Discord 的整页语言恒等于它的
 * 界面语言，跟频道里在聊什么无关。
 */
export async function resolveInputTranslationLang(
  lang: InputTranslationLang,
  config: Config,
  url: string,
  doc: Document,
): Promise<ResolvedInputTranslationLang> {
  if (lang === "targetCode") {
    return { code: config.language.targetCode, source: "explicit" }
  }

  if (lang !== "sourceCode") {
    return { code: lang, source: "explicit" }
  }

  // 用户明确选了源语言就用它。对话检测只填「自动」留下的那个空，不覆盖已表达的意图。
  if (config.language.sourceCode !== "auto") {
    return { code: config.language.sourceCode, source: "explicit" }
  }

  const chatSelector = getChatContextSelector(url)
  if (chatSelector) {
    const chatCode = await detectChatContextLanguage(doc, {
      chatSelector,
      // 噪音排除项复用站点规则已经维护好的那份，不另立一套。
      excludeSelector: getEffectiveSiteRule(config, url).excludeSelector,
    })
    if (chatCode) {
      return { code: chatCode, source: "chatContext" }
    }
  }

  return {
    code: getFinalSourceCode("auto", await getDetectedCodeFromStorage()),
    source: "pageSource",
  }
}
