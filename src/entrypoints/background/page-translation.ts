import type { createPageTranslationQueues } from "@/fork/page-translation/queues"
import type { WebPagePromptContext } from "@/types/content"
import { browser } from "#imports"
import { isLLMProviderConfig } from "@/types/config/provider"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { isNoTranslationSentinel } from "@/utils/constants/prompt"
import { cleanText } from "@/utils/content/utils"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import {
  assertHtmlAttributeMarkerIntegrity,
  hasHtmlAttributeMarkerProtocol,
  isHtmlAttributeMarkerIntegrityError,
} from "@/utils/host/translate/html-attribute-markers"
import {
  auditInlineAtomTokens,
  hasInlineAtomTokens,
} from "@/utils/host/translate/inline-atom-tokens"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { validateProviderHostedFeature } from "@/utils/hosted-ai/routing"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { canProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { TranslationCancelledError } from "@/utils/request/cancellation"
import { getOrGenerateTranslationContextSummary } from "./translation-context-summary"
import {
  buildTranslationScopeKey,
  createWebPageTranslationQueues,
  executeQueuedTranslation,
  getLocalProviderConfig,
  getQueuedTranslationRouting,
  shouldUseBatchQueue,
} from "./translation-queues"

async function getValidatedCachedTranslation(
  hash: string,
  sourceText: string,
  validateHtmlAttributeMarkers: boolean,
  allowSentinel = false,
): Promise<string | undefined> {
  const cached = await db.translationCache.get(hash)
  if (!cached) return undefined
  if (allowSentinel && isNoTranslationSentinel(cached.translation)) return cached.translation
  if (!validateHtmlAttributeMarkers) return cached.translation

  try {
    assertHtmlAttributeMarkerIntegrity(sourceText, cached.translation)
    return cached.translation
  } catch (error) {
    if (!isHtmlAttributeMarkerIntegrityError(error)) throw error

    await db.translationCache.delete(hash)
    logger.warn("Deleted cached translation with invalid HTML attribute markers", error)
    return undefined
  }
}

/** Register handlers synchronously while queue initialization runs in the background. */
export function setupPageTranslationHandlers(
  pageQueueFactory?: typeof createPageTranslationQueues,
): void {
  const { queuesPromise, cancelledScopes } = createWebPageTranslationQueues(pageQueueFactory)

  onMessage("enqueueTranslateRequest", async (message) => {
    const routing = getQueuedTranslationRouting(message.data)
    const queues = await queuesPromise
    const { requestQueue } = queues
    const {
      data: {
        text,
        langConfig,
        providerRef,
        scheduleAt,
        hash: callerHash,
        textFormat,
        preserveLineBreaks,
        webTitle,
        webDescription,
        webContent,
        webSummary,
        sessionId,
        forceRetranslation = false,
        glossaryTerms,
        glossaryRevision,
      },
    } = message
    const scope = buildTranslationScopeKey(message.sender, sessionId)
    const localProvider = getLocalProviderConfig(providerRef)
    // Keep empty/MT snapshots compatible, but do not trust an older caller's
    // hash to distinguish changed terminology for a prompt-driven request.
    const hash =
      callerHash &&
      queues.kind === "fork" &&
      localProvider &&
      isLLMProviderConfig(localProvider) &&
      glossaryTerms?.length
        ? Sha256Hex(
            callerHash,
            JSON.stringify({
              revision: glossaryRevision ?? 0,
              terms: [...glossaryTerms].sort((a, b) => a.matchKey.localeCompare(b.matchKey)),
            }),
          )
        : callerHash

    const validateHtmlAttributeMarkers =
      textFormat === "html" && hasHtmlAttributeMarkerProtocol(text)
    if (validateHtmlAttributeMarkers) {
      assertHtmlAttributeMarkerIntegrity(text, text)
    }

    // Check cache first — unless the user asked for a fresh translation. The
    // existing entry is left untouched unless the fresh request succeeds below.
    if (hash && !forceRetranslation) {
      const cachedTranslation = await getValidatedCachedTranslation(
        hash,
        text,
        validateHtmlAttributeMarkers,
        queues.kind === "fork",
      )
      if (cachedTranslation !== undefined) return cachedTranslation
    }

    // The cache lookup above yielded — the session's cancel may have drained
    // the queues while this handler was suspended. Enqueueing now would park
    // an undraininable task on a dead scope, so abort instead (the content
    // side swallows this error).
    if (scope && cancelledScopes.has(scope)) {
      throw new TranslationCancelledError(scope)
    }

    let result: string
    const context: WebPagePromptContext = {
      webTitle: normalizePromptContextValue(webTitle),
      webDescription: normalizePromptContextValue(webDescription),
      webContent: normalizePromptContextValue(webContent),
      webSummary: normalizePromptContextValue(webSummary),
    }

    if (queues.kind === "fork") {
      const interactive =
        message.data.hostedFeature !== undefined && message.data.hostedFeature !== "pageTranslation"
      if (localProvider && !interactive) {
        const promptConfig = structuredClone(
          ((await getLocalConfig()) ?? DEFAULT_CONFIG).pageTranslation.customPromptsConfig,
        )
        if (scope && cancelledScopes.has(scope)) throw new TranslationCancelledError(scope)
        result = await queues.batchQueue.enqueue({
          text,
          langConfig,
          provider: localProvider,
          promptConfig,
          hash,
          scheduleAt,
          context,
          glossaryTerms,
          glossaryRevision,
          scope,
          textFormat,
          preserveLineBreaks,
          hostedFeature: message.data.hostedFeature,
        })
      } else {
        const hostedRequestId = localProvider ? undefined : getRandomUUID()
        result = await (interactive ? queues.interactionQueue : requestQueue).enqueue(
          (signal) =>
            executeQueuedTranslation(text, langConfig, routing, getTranslatePrompt, {
              context,
              textFormat,
              preserveLineBreaks,
              signal,
              hostedRequestId,
              glossaryTerms,
            }),
          scheduleAt,
          Sha256Hex(hash, scope ?? "", message.data.hostedFeature ?? "pageTranslation"),
          scope ? [scope] : undefined,
        )
      }
    } else if (shouldUseBatchQueue(providerRef)) {
      const data = {
        text,
        langConfig,
        ...routing,
        hash,
        scheduleAt,
        context,
        // Kept off `context`, which is part of the batch key — see
        // `mergeBatchGlossaryTerms`.
        glossaryTerms,
        glossaryRevision,
        scope,
      }
      result = await queues.batchQueue.enqueue(data)
    } else {
      if (!localProvider) {
        throw new Error("Invalid local page translation provider")
      }
      // Create thunk based on type and params
      const thunk = (signal?: AbortSignal) =>
        executeTranslate(text, langConfig, localProvider, getTranslatePrompt, {
          textFormat,
          preserveLineBreaks,
          signal,
        })
      result = await requestQueue.enqueue(thunk, scheduleAt, hash, scope ? [scope] : undefined)
    }

    if (scope && cancelledScopes.has(scope)) throw new TranslationCancelledError(scope)
    if (
      validateHtmlAttributeMarkers &&
      !(queues.kind === "fork" && isNoTranslationSentinel(result))
    ) {
      assertHtmlAttributeMarkerIntegrity(text, result)
    }

    // A response that dropped, invented or duplicated an inline-atom
    // placeholder is still rendered by the content script (the formulas are
    // appended) but must not be persisted: the next visit deserves a fresh
    // attempt instead of a permanently degraded paragraph. The sentinel is
    // exempt — "no translation needed" carries no placeholders by definition,
    // and auditing it as a total loss would make every already-in-target-language
    // paragraph containing a formula re-hit the provider on every page load.
    const inlineAtomTokensIntact =
      !hasInlineAtomTokens(text) ||
      isNoTranslationSentinel(result) ||
      auditInlineAtomTokens(text, result).ok
    if (result && !inlineAtomTokensIntact) {
      logger.warn("Inline atom placeholders were not preserved; result not cached")
    }

    // Cache the translation result if successful
    if (result && hash && inlineAtomTokensIntact) {
      await db.translationCache.put({
        key: hash,
        translation: result,
        createdAt: new Date(),
      })
    }

    return result
  })

  onMessage("getOrGenerateWebPageSummary", async (message) => {
    validateProviderHostedFeature(message.data.providerRef, message.data.hostedFeature)
    const queues = await queuesPromise
    const interactive =
      message.data.hostedFeature !== undefined && message.data.hostedFeature !== "pageTranslation"
    const requestQueue =
      queues.kind === "fork" && interactive ? queues.interactionQueue : queues.requestQueue
    const { webTitle, webContent, providerRef } = message.data

    if (!webTitle || !webContent) {
      return null
    }

    // The payload type forces senders to narrow, but the wire is a trust
    // boundary (a pre-update content script can send a translate-only ref).
    // Refuse like the subtitle summary handlers do: a queue task for a
    // provider with no model to prompt can only ever throw, after burning
    // its retries.
    if (!canProviderRefGenerateText(providerRef)) {
      return null
    }

    return await getOrGenerateTranslationContextSummary({
      ...message.data,
      title: webTitle,
      textContent: webContent,
      cacheKeyParts: [webTitle, Sha256Hex(cleanText(webContent))],
      requestQueue,
    })
  })

  onMessage("cancelPageTranslationRequests", async (message) => {
    const scope = buildTranslationScopeKey(message.sender, message.data.sessionId)
    if (!scope) return
    // Remember the scope BEFORE any await so enqueue handlers suspended on
    // the cache lookup refuse to enqueue after this drain.
    cancelledScopes.markScope(scope)
    const queues = await queuesPromise
    const { requestQueue, batchQueue } = queues
    // Batch queue first so pending batches cannot flush new request-queue
    // tasks between the two drains.
    const cancelledBatch = batchQueue.cancelByScope(scope)
    const cancelledRequests =
      requestQueue.cancelByScope(scope) +
      (queues.kind === "fork" ? queues.interactionQueue.cancelByScope(scope) : 0)
    if (cancelledBatch + cancelledRequests > 0) {
      logger.info(
        `Cancelled ${cancelledBatch + cancelledRequests} page-translation requests (scope: ${scope})`,
      )
    }
  })

  // A closed tab can never send its cancel message — sweep every scope the
  // tab ever registered (#1881).
  browser.tabs.onRemoved.addListener((tabId) => {
    const prefix = `${tabId}:`
    cancelledScopes.markPrefix(prefix)
    void queuesPromise.then((queues) => {
      const { requestQueue, batchQueue } = queues
      batchQueue.cancelWhere((scope) => scope.startsWith(prefix))
      requestQueue.cancelWhere((scope) => scope.startsWith(prefix))
      if (queues.kind === "fork") {
        queues.interactionQueue.cancelWhere((scope) => scope.startsWith(prefix))
      }
    })
  })
}
