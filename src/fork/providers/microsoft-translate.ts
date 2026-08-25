import type { TranslationTextFormat } from "@/types/config/translate"
import { decodeHTMLStrict, escapeText } from "entities"
import { attachRequestErrorMeta } from "@/utils/request/retry-policy"

// fork 接管的微软翻译适配器（换皮上游 src/utils/host/translate/api/microsoft.ts，
// 重定向清单见 wxt.config.ts 的 FORK_UI_REDIRECTS）。
//
// 免鉴权端点，取代已下线的 api-edge.cognitive.microsofttranslator.com 流程——后者的
// 令牌端点 edge.microsoft.com/translate/auth 于 2026-07 被上游删除、现返回 404。
// 请求体是裸 JSON 字符串数组（服务端拒绝旧的 [{ Text }] 形状），`from`/`to` 是仅有的
// 生效参数（`textType` 已不存在）。
const MICROSOFT_TRANSLATE_URL = "https://edge.microsoft.com/translate/translatetext"

export async function microsoftTranslate(
  source: string,
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string>
export async function microsoftTranslate(
  source: string[],
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string[]>
export async function microsoftTranslate(
  source: string | string[],
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string | string[]> {
  const isSingle = typeof source === "string"
  const texts = isSingle ? [source] : source

  if (texts.length === 0) {
    return []
  }

  // 端点没有保留标记的模式：带属性的 HTML 会被以目标语相关的方式破坏（属性名被翻译、
  // 引号被转成弯引号、标签名被吞），无法后处理还原。配置门禁（translation-only-gate）
  // 负责让 translationOnly 页面模式——唯一的 html 调用方——形不成这个组合；这里硬失败
  // 是兜底，阻断任何残留路径经 innerHTML 注入损坏的标记。
  if (options?.textFormat === "html") {
    throw new Error("Microsoft translator does not support HTML fragments")
  }

  const effectiveFromLang = fromLang === "auto" ? "" : fromLang

  // 端点对每个请求都跑微软的 HTML 标签对齐器，裸 "<" 会被融合成伪标签
  // （"a < b and c > d" 会回来变成 "<B和C> d"）。与 google.ts 同样先转义；
  // 转义后的实体原样往返。
  const requestTexts = texts.map((text) => escapeText(text))

  const resp = await fetch(
    `${MICROSOFT_TRANSLATE_URL}?from=${encodeURIComponent(effectiveFromLang)}&to=${encodeURIComponent(toLang)}&isEnterpriseClient=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestTexts),
      signal: options?.signal,
    },
  ).catch((error) => {
    throw attachRequestErrorMeta(
      new Error(`Network error during Microsoft translation: ${error.message}`),
      { kind: "network", isRetryable: true },
    )
  })

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "Unable to read error response")
    throw attachRequestErrorMeta(
      new Error(
        `Microsoft translation request failed: ${resp.status} ${resp.statusText}${
          errorText ? ` - ${errorText}` : ""
        }`,
      ),
      {
        statusCode: resp.status,
        responseHeaders: resp.headers,
      },
    )
  }

  try {
    const result = await resp.json()

    if (!Array.isArray(result) || result.length !== texts.length) {
      throw new Error(
        `Unexpected response format: expected ${texts.length} results, got ${Array.isArray(result) ? result.length : "non-array"}`,
      )
    }

    const translations = result.map(
      (item: { translations?: { text?: string }[] }, index: number) => {
        const text = item?.translations?.[0]?.text
        if (text === null || text === undefined) {
          throw new Error(`Missing translation for item at index ${index}`)
        }
        // 与上面的 escapeText 成对：请求侧转义、响应侧解一次。上游把这步放在共享的
        // translation-output-normalization.ts（对 microsoft 解码），fork 不改那个文件，
        // 改在此处自解——顺带让绕过归一化的 microsoftBatchTranslate 路径也正确。
        // 若某次同步后上游归一化开始对 microsoft 解码，此处必须删除，否则双重解码；
        // src/fork/providers/__tests__/upstream-decode-drift.test.ts 是对应的哨兵。
        return decodeHTMLStrict(text)
      },
    )

    return isSingle ? translations[0] : translations
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse Microsoft translation response: ${message}`, { cause: error })
  }
}
