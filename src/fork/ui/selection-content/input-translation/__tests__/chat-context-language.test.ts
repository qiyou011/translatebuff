// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { detectChatContextLanguage } from "../chat-context-language"

const CHAT_SELECTOR = "li[id^=chat-messages] div[id^=message-content]"
const EXCLUDE_SELECTOR = "[class*='username'],span[class*='timestamp_']"

/** 按 Discord 的真实结构铺消息：每条一个 li，内含 message-content。 */
function renderMessages(messages: string[], options: { noise?: boolean } = {}) {
  document.body.innerHTML = messages
    .map((text, index) => {
      const noise = options.noise
        ? `<span class="username_abc">SomeVeryLongEnglishUserName</span>` +
          `<span class="timestamp_abc">Yesterday at 11:45 PM (edited)</span>`
        : ""
      return (
        `<li id="chat-messages-${index}"><div id="message-content-${index}">` +
        `${noise}${text}</div></li>`
      )
    })
    .join("")
}

const RU = [
  "Элис, еще раз добрый день! У меня появились срочные обстоятельства.",
  "Поэтому я смогу очень мало времени уделять стримам, к сожалению.",
  "Можем ли мы заморозить на месяц вопрос о сотрудничестве?",
]
const JA = [
  "皆さん、こんばんは。今日もよろしくお願いします。",
  "明日の配信は九時からになります。",
  "遅れてすみません、少し用事がありました。",
]
const KO = [
  "안녕하세요 여러분, 오늘도 잘 부탁드립니다.",
  "내일 방송은 아홉 시부터 시작합니다.",
  "조금 늦어서 죄송합니다.",
]

describe("detectChatContextLanguage", () => {
  it("单一语种的对话按该语种判定", async () => {
    renderMessages(JA)
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBe("jpn")
  })

  it("对话中途切换语种时，只看最近 5 条", async () => {
    // 韩语在前、日语在后，且韩语条数多于日语——取末 5 条必须判为日语。
    renderMessages([...KO, ...KO, ...JA, ...JA])
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBe("jpn")
  })

  it("消息不足 5 条时用现有的全部消息", async () => {
    renderMessages(RU.slice(0, 2))
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBe("rus")
  })

  it("没有任何消息节点时返回 null", async () => {
    document.body.innerHTML = ""
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBeNull()
  })

  it("消息判不出语种时返回 null", async () => {
    renderMessages(["👍👍👍", "https://example.com/a", "😀 🎉"])
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBeNull()
  })

  it("剔除用户名与时间戳，避免英文噪音把判定拽偏", async () => {
    // 噪音是长英文串，且条数少、俄语正文短——不剔除就会被判成英语。
    renderMessages(RU.slice(0, 1), { noise: true })
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBe("rus")
  })

  it("剔除噪音后仍保留正文：@提及无法剔除属已知限制，俄语消息仍判为俄语", async () => {
    renderMessages([
      `<span class="mention_abc">@SomeUser</span> ${RU[0]}`,
      `<span class="mention_abc">@Another</span> ${RU[1]}`,
      RU[2]!,
    ])
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBe("rus")
  })

  it("短到判不出的拉丁文本返回 null", async () => {
    // franc 拒判 10 字符以下，且拉丁字形不指向任何单一语种，只能认输。
    renderMessages(["ok", "yes"])
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBeNull()
  })

  it("短假名按字形判为日语，短谚文判为韩语", async () => {
    // franc 够不着的长度，但假名与谚文各自只有一种语言在用，可以直接认。
    renderMessages(["はい"])
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBe("jpn")

    renderMessages(["넵"])
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBe("kor")
  })

  it("短西里尔不按字形猜——俄语／塞尔维亚语／乌克兰语共用同一套字母", async () => {
    renderMessages(["да"])
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBeNull()
  })

  it("最近一条是短日语、前面夹着机器人的长英文公告时，仍判为日语", async () => {
    // 人工验收现场：Discord 的 MEE6 机器人插了一条 57 字符的英文公告，
    // 而人类消息都很短。拼起来按长度算，英文会把日语压过去。
    renderMessages([
      "誰もいねーじゃん。",
      "GG @Customer Service: Kelly, you just advanced to level 1!",
      "안사요 안사",
      "돈 없쇼",
      "こんばんは",
    ])
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: EXCLUDE_SELECTOR,
      }),
    ).resolves.toBe("jpn")
  })

  it("没有 excludeSelector 时不报错", async () => {
    renderMessages(JA)
    await expect(
      detectChatContextLanguage(document, {
        chatSelector: CHAT_SELECTOR,
        excludeSelector: null,
      }),
    ).resolves.toBe("jpn")
  })

  it("chatSelector 为空时返回 null，不做任何查询", async () => {
    renderMessages(JA)
    await expect(
      detectChatContextLanguage(document, { chatSelector: null, excludeSelector: null }),
    ).resolves.toBeNull()
  })
})
