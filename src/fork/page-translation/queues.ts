import type { PageTranslationData, ItemOutcome } from "./types"
import type { BatchQueueConfig, RequestQueueConfig } from "@/types/config/translate"
import { isLLMProviderConfig } from "@/types/config/provider"
import { putBatchRequestRecord } from "@/utils/batch-request-record"
import {
  BATCH_TIMEOUT_BASE_MS,
  BATCH_TIMEOUT_PER_CHAR_MS,
  MAX_BATCH_TIMEOUT_MS,
} from "@/utils/constants/translate"
import { Sha256Hex } from "@/utils/hash"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { getTranslatePromptFromConfig } from "@/utils/prompts/translate"
import { BatchQueue } from "@/utils/request/batch-queue"
import { TranslationCancelledError } from "@/utils/request/cancellation"
import { RequestQueue } from "@/utils/request/request-queue"
import {
  canUseStructuredPage,
  decodePageLlm,
  PageJsonModeUnsupportedError,
  requestPageLlm,
} from "./llm"
import { decodePageMt, getMtItemBytes, isPageMt, requestPageMt } from "./mt"
import { PAGE_MAX_CONCURRENT, PAGE_MT_MAX_ITEMS, PAGE_MT_PAYLOAD_BYTES } from "./policy"
import { PageProtocolError } from "./wire"

export interface PageQueueConfig {
  requestQueueConfig: RequestQueueConfig
  batchQueueConfig: BatchQueueConfig
  isScopeCancelled: (scope: string) => boolean
  maxConcurrent?: number
}

export function getPageBatchKey(data: PageTranslationData): string {
  return Sha256Hex(
    JSON.stringify({
      provider: data.provider,
      prompt: data.promptConfig,
      language: data.langConfig,
      context: data.context,
      format: data.textFormat ?? "plain",
      lines: !!data.preserveLineBreaks,
      scope: data.scope ?? null,
      feature: data.hostedFeature ?? "pageTranslation",
      structured: isLLMProviderConfig(data.provider) && canUseStructuredPage(data),
    }),
  )
}

export function createPageTranslationQueues(config: PageQueueConfig) {
  const requestQueue = new RequestQueue({
    ...config.requestQueueConfig,
    maxConcurrent: config.maxConcurrent ?? PAGE_MAX_CONCURRENT,
    timeoutMs: 20000,
    maxRetries: 2,
    baseRetryDelayMs: 1000,
  })
  const interactionQueue = new RequestQueue({
    ...config.requestQueueConfig,
    timeoutMs: 20000,
    maxRetries: 2,
    baseRetryDelayMs: 1000,
  })
  const live = (data: PageTranslationData) => {
    if (data.scope && config.isScopeCancelled(data.scope))
      throw new TranslationCancelledError(data.scope)
  }
  const failure = (error: unknown): ItemOutcome => ({
    ok: false,
    error: error instanceof Error ? error : new Error(String(error)),
  })

  async function invoke(items: PageTranslationData[], individual = false): Promise<unknown> {
    const first = items[0]!
    items.forEach(live)
    const total = items.reduce((sum, item) => sum + item.text.length, 0)
    const hash = Sha256Hex(
      getPageBatchKey(first),
      individual ? "single" : "batch",
      ...items.map((data) => data.hash),
      ...items.map((data) => data.text),
    )
    return requestQueue.enqueue(
      async (signal) => {
        items.forEach(live)
        if (isLLMProviderConfig(first.provider)) {
          await putBatchRequestRecord({
            originalRequestCount: items.length,
            providerConfig: first.provider,
          })
          if (signal?.aborted) throw signal.reason
          return requestPageLlm(items, signal, individual)
        }
        if (isPageMt(first)) return requestPageMt(items, signal)
        return executeTranslate(
          first.text,
          first.langConfig,
          first.provider,
          async (target, input, options) =>
            getTranslatePromptFromConfig(
              { customPromptsConfig: first.promptConfig },
              target,
              input,
              options,
            ),
          {
            textFormat: first.textFormat,
            preserveLineBreaks: first.preserveLineBreaks,
            signal,
            context: first.context,
          },
        )
      },
      Math.min(...items.map((data) => data.scheduleAt)),
      hash,
      first.scope ? [first.scope] : undefined,
      {
        timeoutMs: Math.min(
          BATCH_TIMEOUT_BASE_MS + total * BATCH_TIMEOUT_PER_CHAR_MS,
          MAX_BATCH_TIMEOUT_MS,
        ),
      },
    )
  }

  function decode(raw: unknown, items: PageTranslationData[], individual = false) {
    return isLLMProviderConfig(items[0]!.provider)
      ? decodePageLlm(raw as string, items, individual)
      : isPageMt(items[0]!)
        ? decodePageMt(raw, items)
        : [typeof raw === "string" && raw.trim() ? raw.trim() : undefined]
  }

  async function single(data: PageTranslationData): Promise<ItemOutcome> {
    try {
      live(data)
      const raw = await invoke([data], true)
      live(data)
      const value = decode(raw, [data], true)[0]
      return value === undefined
        ? failure(new PageProtocolError("Invalid individual translation"))
        : { ok: true, value }
    } catch (error) {
      return failure(error)
    }
  }

  async function executeBatch(items: PageTranslationData[]): Promise<ItemOutcome[]> {
    let raw: unknown
    try {
      raw = await invoke(items)
    } catch (error) {
      if (!(error instanceof PageJsonModeUnsupportedError)) throw error
      return Promise.all(items.map(single))
    }
    // Await has left the network task. Fallback can enqueue without occupying a slot.
    let decoded: (string | undefined)[]
    try {
      decoded = decode(raw, items)
    } catch {
      decoded = items.map(() => undefined)
    }
    return Promise.all(
      items.map(async (data, index) => {
        try {
          live(data)
        } catch (error) {
          return failure(error)
        }
        const value = decoded[index]
        return value === undefined ? single(data) : { ok: true as const, value }
      }),
    )
  }

  const common = {
    batchDelay: 100,
    maxRetries: 0,
    enableFallbackToIndividual: false,
    getBatchKey: getPageBatchKey,
    getDedupKey: (data: PageTranslationData) =>
      Sha256Hex(getPageBatchKey(data), data.hash, data.text),
    getScope: (data: PageTranslationData) => data.scope,
    isScopeCancelled: config.isScopeCancelled,
    dispatchGate: { nextDispatchEtaMs: () => requestQueue.nextDispatchEtaMs() },
    executeBatch,
  }
  const llmBatch = new BatchQueue<PageTranslationData, ItemOutcome>({
    ...common,
    ...config.batchQueueConfig,
    getCharacters: (data) => data.text.length,
  })
  const mtBatch = new BatchQueue<PageTranslationData, ItemOutcome>({
    ...common,
    maxItemsPerBatch: PAGE_MT_MAX_ITEMS,
    maxCharactersPerBatch: PAGE_MT_PAYLOAD_BYTES - 512,
    getCharacters: getMtItemBytes,
  })

  const batchQueue = {
    async enqueue(input: PageTranslationData): Promise<string> {
      const data = structuredClone(input)
      data.text = prepareTranslationText(data.text)
      live(data)
      if (!data.text) return ""
      // Unsupported MT formats fail before networking, not as an automatic retry.
      if (data.provider.provider === "microsoft-translate" && data.textFormat === "html")
        throw new Error("Microsoft translator does not support HTML fragments")
      const result = await (isLLMProviderConfig(data.provider)
        ? llmBatch.enqueue(data)
        : isPageMt(data)
          ? mtBatch.enqueue(data)
          : single(data))
      live(data)
      if (!result.ok) throw result.error
      return result.value
    },
    setBatchConfig(options: Partial<BatchQueueConfig>) {
      llmBatch.setBatchConfig(options)
    },
    cancelByScope(scope: string) {
      return llmBatch.cancelByScope(scope) + mtBatch.cancelByScope(scope)
    },
    cancelWhere(predicate: (scope: string) => boolean) {
      return llmBatch.cancelWhere(predicate) + mtBatch.cancelWhere(predicate)
    },
  }
  return { requestQueue, interactionQueue, batchQueue }
}
