import type { ForkEdition } from "../identity/edition"
import { FORK_BRANDING, getForkDisplayName } from "../branding"

// WXT 的 manifest 文案不走运行时 i18next；仅处理生成资源的描述，不改变其他消息。
export function brandChromeMessages(
  contents: string,
  edition: ForkEdition,
  locale?: string,
): string {
  const messages = JSON.parse(contents)
  if (typeof messages.extDescription?.message === "string") {
    messages.extDescription.message = messages.extDescription.message
      .replaceAll(FORK_BRANDING.displayName, getForkDisplayName(edition))
      .replaceAll(FORK_BRANDING.name, getForkDisplayName(edition))
    if (edition === "cn" && locale === "zh_CN") {
      messages.extDescription.message =
        "使用 20+ AI 模型翻译网页、文本、消息和视频字幕。支持双语阅读、翻译对比和上下文理解。"
    } else if (edition === "global" && locale === "en") {
      messages.extDescription.message =
        "Translate webpages, text, messages, and subtitles with 20+ AI models. Read bilingually, compare translations, and stay in context."
    }
  }
  return JSON.stringify(messages)
}
