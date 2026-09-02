import type { LangCodeISO6393 } from "@read-frog/definitions"
import { detectLanguage } from "./language"

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

  const text = messages
    .slice(-limit)
    .map((message) => extractMessageText(message, excludeSelector))
    .filter(Boolean)
    .join("\n")

  return detectLanguage(text, { enableLLM: false })
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
