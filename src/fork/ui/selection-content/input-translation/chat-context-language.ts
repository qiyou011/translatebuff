import type { LangCodeISO6393 } from "@read-frog/definitions"
import { detectLanguage } from "@/utils/content/language"

/**
 * 判定「当前对话」语种所需的两个选择器。
 *
 * 刻意只吃字符串而不吃 `ResolvedSiteRule`：选择器由谁提供（站点规则字段 / 站点映射表）
 * 是上层的事，本函数对此无知，于是两种供给方式共用同一份实现与同一份测试。
 */
export interface ChatContextSelectors {
  /** 命中「一条消息的正文」的选择器。为空表示本站点没有聊天上下文可用。 */
  chatSelector: string | null
  /** 消息正文内部要剔除的噪音节点（时间戳、用户名、回复预览）。 */
  excludeSelector: string | null
}

/** 取最近多少条消息参与判定。5 条足以跨过 franc 的最短长度，又不至于把话题切换前的语种算进来。 */
const DEFAULT_MESSAGE_LIMIT = 5

/**
 * 按最近若干条对话消息判定语种。
 *
 * 用于输入翻译：整页语言在 Discord 这类站点上恒等于界面语言（英文），与频道里正在聊的
 * 语种无关，因此「网页源语言」必须改看对话本身。
 *
 * 判不出（无节点、文本过短、franc 返回 und）一律回 `null`，由调用方回退整页源语言。
 */
export async function detectChatContextLanguage(
  doc: Document,
  selectors: ChatContextSelectors,
  limit: number = DEFAULT_MESSAGE_LIMIT,
): Promise<LangCodeISO6393 | null> {
  const { chatSelector, excludeSelector } = selectors
  if (!chatSelector) {
    return null
  }

  const messages = Array.from(doc.querySelectorAll(chatSelector))
  if (messages.length === 0) {
    return null
  }

  const recent = messages
    .slice(-limit)
    .map((message) => extractMessageText(message, excludeSelector))
    .filter(Boolean)

  // 从最新一条往回走，取第一条能判出语种的。
  //
  // 不能把这几条拼起来一次判：franc 是按长度加权的，而聊天室里最长的那条往往是机器人的
  // 英文公告（实测「GG @Someone, you just advanced to level 1!」57 字符），它会把周围几条
  // 短的人类消息整个压过去——人工验收就是栽在这里，一屋子日韩对话被判成英语。
  // 「跟最近一条」也正是用户对这个功能的预期。
  const newest = recent[recent.length - 1]!

  // 假名与谚文各自只有一种语言在用，一个字就够定案，不必凑长度。
  const decisive = detectByDecisiveScript(newest)
  if (decisive) {
    return decisive
  }

  // 其余文字系统要靠 franc，而 franc 需要足够长的文本才分得开同族语言（一条 67 字符的
  // 俄语单独喂进去会被判成塞尔维亚语）。于是把窗口内**与最新一条同文字系统**的消息合起来
  // 凑长度——同时也就把机器人的英文公告挡在了西里尔／日文对话之外。
  //
  // 不合并全部消息正是人工验收暴露的那个坑：franc 按长度加权，聊天室里最长的往往是机器人
  // 那条英文公告（实测「GG @Someone, you just advanced to level 1!」57 字符），它能把一屋子
  // 日韩对话整个压成英语。
  const newestScript = classifyScript(newest)
  const sameScript = recent.filter((message) => classifyScript(message) === newestScript)

  return detectLanguage(sameScript.join("\n"), { enableLLM: false })
}

/** 文本属于哪套文字系统。只用来分组，不直接映射语种。 */
function classifyScript(text: string): string {
  if (KANA_PATTERN.test(text)) return "kana"
  if (HANGUL_PATTERN.test(text)) return "hangul"
  if (CYRILLIC_PATTERN.test(text)) return "cyrillic"
  if (HAN_PATTERN.test(text)) return "han"
  return "other"
}

/** 西里尔：俄语／塞尔维亚语／乌克兰语等共用，只能分组、不能直接定语种。 */
const CYRILLIC_PATTERN = /[Ѐ-ӿ]/
/** 汉字：中日共用，同理只分组。 */
const HAN_PATTERN = /[㐀-䶿一-鿿]/

/** 假名：只有日语在用。 */
const KANA_PATTERN = /[぀-ゟ゠-ヿ]/
/** 谚文：只有韩语在用。 */
const HANGUL_PATTERN = /[ᄀ-ᇿ가-힯]/

/**
 * 按字形判语种，只认唯一映射的那两种。
 *
 * franc 自己拒判 10 字符以下的文本，而聊天里「こんばんは」这类一句话恰恰不到 10 个字——
 * 光靠 franc 会把最该跟随的那条漏掉，退而去读上一条机器人的长英文公告。
 *
 * 刻意只认假名与谚文：汉字是中日共用、西里尔是俄语／塞尔维亚语／乌克兰语共用，按字形猜
 * 会猜错（实测一条短俄语被判成塞尔维亚语）。这两类仍旧交给 franc，宁可判不出也不猜。
 */
function detectByDecisiveScript(text: string): LangCodeISO6393 | null {
  if (KANA_PATTERN.test(text)) {
    return "jpn"
  }
  if (HANGUL_PATTERN.test(text)) {
    return "kor"
  }
  return null
}

/**
 * 取一条消息的纯文本。
 *
 * 先克隆再删噪音节点——直接在真实 DOM 上删会毁掉页面。剔得掉时间戳、用户名、回复预览；
 * 剔不掉行内 @提及与频道链接（Discord 用 `<span class="mention_*">`，站点规则的排除项
 * 没有一条命中它），那部分拉丁字符会轻微把判定拽向英语，属已知限制，由界面上的手动改
 * 语言兜底。
 */
function extractMessageText(message: Element, excludeSelector: string | null): string {
  const clone = message.cloneNode(true) as Element
  if (excludeSelector) {
    for (const noisy of Array.from(clone.querySelectorAll(excludeSelector))) {
      noisy.remove()
    }
  }
  return (clone.textContent ?? "").replace(URL_PATTERN, " ").replace(/\s+/g, " ").trim()
}

/**
 * 链接不是自然语言，但长度足以让 franc 给出一个自信的错误答案（实测一条纯链接的消息被判成
 * 法语）。判定前先抹掉，让「只发了个链接」老实落到 und、回退整页源语言。
 */
const URL_PATTERN = /\bhttps?:\/\/\S+/gi
