import type { PageTranslationData } from "./types"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { generateText } from "ai"
import { isRenyimiaoInstance } from "@/fork/providers/renyimiao-identity"
import { isLLMProviderConfig } from "@/types/config/provider"
import {
  BATCH_SEPARATOR,
  BATCH_SEPARATOR_LINE_PATTERN,
  DEFAULT_SENTINEL_TRANSLATE_PROMPT,
  DEFAULT_TRANSLATE_PROMPT_ID,
  isNoTranslationSentinel,
} from "@/utils/constants/prompt"
import { extractAISDKErrorMessage } from "@/utils/error/extract-message"
import { assertHtmlAttributeMarkerIntegrity } from "@/utils/host/translate/html-attribute-markers"
import { getTranslatePromptFromConfig } from "@/utils/prompts/translate"
import { getLanguageModelForConfig } from "@/utils/providers/model"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { getTopLevelReasoning } from "@/utils/providers/reasoning"
import { attachRequestErrorMeta, getRequestErrorMeta } from "@/utils/request/retry-policy"
import { compactPageHtml, PageProtocolError, parseFlatTranslations, restorePageHtml } from "./wire"

export class PageJsonModeUnsupportedError extends PageProtocolError {}

export function canUseStructuredPage(data: PageTranslationData): boolean {
  return (
    (data.promptConfig.promptId || DEFAULT_TRANSLATE_PROMPT_ID) === DEFAULT_TRANSLATE_PROMPT_ID &&
    (data.textFormat !== "html" || compactPageHtml(data.text) !== null)
  )
}

export function buildPageLlmPrompt(items: PageTranslationData[], individual = false) {
  const first = items[0]!
  const structured = !individual && items.every(canUseStructuredPage)
  const input = structured
    ? JSON.stringify(
        Object.fromEntries(
          items.map((item, index) => [
            `t${index}`,
            item.textFormat === "html" ? compactPageHtml(item.text) : item.text,
          ]),
        ),
      )
    : items.map((item) => item.text).join(`\n\n${BATCH_SEPARATOR}\n\n`)
  const target = LANG_CODE_TO_EN_NAME[first.langConfig.targetCode]
  const prompt = getTranslatePromptFromConfig(
    { customPromptsConfig: first.promptConfig },
    target,
    input,
    {
      context: first.context,
      isBatch: !structured && !individual,
    },
  )
  if (structured) {
    prompt.systemPrompt += `\nReturn only a JSON object with the same keys as input (t0, t1, ...). Translate each string independently; preserve HTML tags and ids. No extra keys.\n${DEFAULT_SENTINEL_TRANSLATE_PROMPT.replaceAll("{{targetLanguage}}", target)}`
  }
  return { ...prompt, structured }
}

// Only transport and SDK errors here. Never retry malformed model output as a network error.
export async function requestPageLlm(
  items: PageTranslationData[],
  signal?: AbortSignal,
  individual = false,
): Promise<string> {
  const provider = items[0]!.provider
  if (!isLLMProviderConfig(provider)) throw new Error("Expected page LLM provider")
  const { systemPrompt, prompt, structured } = buildPageLlmPrompt(items, individual)
  const reasoning = getTopLevelReasoning(provider)
  let providerOptions = getProviderOptionsWithOverride(
    resolveModelId(provider.model) ?? "",
    provider.provider,
    provider.providerOptions,
    reasoning,
  )
  if (structured && isRenyimiaoInstance(provider)) {
    providerOptions = {
      ...providerOptions,
      [provider.provider]: {
        ...providerOptions?.[provider.provider],
        response_format: { type: "json_object" },
      },
    }
  }
  try {
    const result = await generateText({
      model: getLanguageModelForConfig(provider),
      instructions: systemPrompt,
      prompt,
      reasoning,
      temperature: provider.temperature,
      providerOptions,
      abortSignal: signal,
      maxRetries: 0,
    })
    return /<\/think>([\s\S]*)/.exec(result.text)?.[1] ?? result.text
  } catch (error) {
    const meta = getRequestErrorMeta(error)
    const message = extractAISDKErrorMessage(error)
    if (
      structured &&
      meta.statusCode === 400 &&
      /response_format/i.test(message) &&
      /unavailable|unsupported|not support/i.test(message)
    ) {
      throw attachRequestErrorMeta(new PageJsonModeUnsupportedError("JSON mode unsupported"), {
        ...meta,
        isRetryable: false,
      })
    }
    if (error instanceof Error) {
      error.message = message
      throw attachRequestErrorMeta(error, meta)
    }
    throw attachRequestErrorMeta(new Error(message), meta)
  }
}

export function decodePageLlm(
  raw: string,
  items: PageTranslationData[],
  individual = false,
): (string | undefined)[] {
  const structured = !individual && items.every(canUseStructuredPage)
  const values = structured
    ? parseFlatTranslations(raw, items.length)
    : individual
      ? [raw.trim()]
      : raw
          .trim()
          .split(BATCH_SEPARATOR_LINE_PATTERN)
          .map((text) => text.trim())
  if (values.length !== items.length)
    throw new PageProtocolError("Unaligned translation result count")
  return values.map((value, index) => {
    if (!value?.trim()) return undefined
    const item = items[index]!
    try {
      if (item.textFormat !== "html" || isNoTranslationSentinel(value)) return value
      if (structured) return restorePageHtml(item.text, value)
      assertHtmlAttributeMarkerIntegrity(item.text, value)
      return value
    } catch {
      return undefined
    }
  })
}
