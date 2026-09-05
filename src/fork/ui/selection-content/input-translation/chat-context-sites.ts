import { urlMatchesPattern } from "@/utils/site-rules/match"

/**
 * 声明了「对话消息长什么样」的站点。
 *
 * 刻意没有做成站点规则（`siteRuleSchema`）的新字段：那个 schema 在 `src/types/config/`，
 * 属 fork 的绝不改区，加字段会让 fork 在上游合并之前永远带不了这份数据，主路径与后备
 * 路径的数据来源就此分叉。放成独立映射表则两边共用同一份实现。
 *
 * 排除项不在这里：消息内部要剔除的噪音（时间戳、用户名、回复预览）站点规则已经维护得
 * 很好，直接取 `getEffectiveSiteRule().excludeSelector` 即可，不重复一份。
 */
interface ChatContextSite {
  /** 与站点规则同一套匹配语法，复用 `urlMatchesPattern`。 */
  matches: string
  /** 命中「一条消息的正文」。 */
  chatSelector: string
}

const CHAT_CONTEXT_SITES: ChatContextSite[] = [
  {
    // 只认频道页：发现页、设置页没有对话，套上去只会拿整页 chrome 去判语种。
    matches: "https://discord.com/channels/*",
    chatSelector: "li[id^=chat-messages] div[id^=message-content]",
  },
]

/** 当前地址所属站点的消息选择器；未登记的站点返回 `null`，调用方据此回退整页源语言。 */
export function getChatContextSelector(url: string): string | null {
  const site = CHAT_CONTEXT_SITES.find((candidate) => urlMatchesPattern(url, candidate.matches))
  return site?.chatSelector ?? null
}
