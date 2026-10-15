import type { SelectionPopoverActions } from "@/components/ui/selection-popover"
import type { SelectionToolbarInlineError } from "@/components/ui/selection-popover/inline-error"
import type {
  SelectionSession,
  SelectionToolbarTranslateRequestSlice,
} from "@/entrypoints/selection.content/selection-toolbar/atoms"
import type { FeatureProviderAnalytics } from "@/types/analytics"
import type { BackgroundTextStreamSnapshot, ThinkingSnapshot } from "@/types/background-stream"
import type {
  LLMProviderConfig,
  ProviderConfig,
  TranslateProviderConfig,
} from "@/types/config/provider"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import {
  createSelectionToolbarPrecheckError,
  createSelectionToolbarRuntimeError,
  isAbortError,
} from "@/components/ui/selection-popover/inline-error"
import {
  isSelectionToolbarOpenAtom as isSelectionToolbarVisibleAtom,
  selectionSessionAtom,
  selectionToolbarTranslateRequestAtom,
} from "@/entrypoints/selection.content/selection-toolbar/atoms"
import { useSelectionOpenRequestResolver } from "@/entrypoints/selection.content/selection-toolbar/use-selection-open-request"
import { useSelectionShortcuts } from "@/entrypoints/selection.content/selection-toolbar/use-selection-shortcuts"
import { captureSelectionActionContext } from "@/entrypoints/selection.content/utils"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { isLLMProviderConfig, isTranslateProviderConfig } from "@/types/config/provider"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyProviderConfig, UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { buildFeatureProviderPatch } from "@/utils/constants/feature-providers"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { getSourceDocumentTitle } from "@/utils/content/document-title"
import { resolveGlossaryTermsFromCache } from "@/utils/glossary/active-matcher"
import { trackGlossaryUsed } from "@/utils/glossary/analytics"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { translateTextCore } from "@/utils/host/translate/translate-text"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { getOrGenerateWebPageSummary } from "@/utils/host/translate/webpage-summary"
import { onMessage } from "@/utils/message"
import { getTranslatePromptFromConfig } from "@/utils/prompts/translate"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { getTopLevelReasoning } from "@/utils/providers/reasoning"

// fork 翻译浮窗 controller —— 逐行镜像上游 translate-button/provider.tsx 的编排状态机
// （helpers :82-236 + provider body :260-736），return 全部态 + handlers 供薄壳组合 JSX。
// 引擎原语（streamBackgroundText / translateTextCore / getTranslatePromptFromConfig / provider-registry
// / config atoms / atoms.ts …）全部 import 上游，不复制引擎本体；三个 web-page/流式编排 helper 因上游
// module-private（未导出）无法 import，随 body 一并镜像。
// 已删除：所有「猜你想存」相关行——不实例化其 hook、不发 AI 建议请求、不渲染其卡片（见 design D5）。
// 同步纪律：diff 上游 provider.tsx → 把 delta 搬到本文件；结构 1:1，机械低认知。

interface SelectionTranslatePendingOpenRequest {
  anchor?: { x: number; y: number }
  session: SelectionSession
  surface:
    | typeof ANALYTICS_SURFACE.SELECTION_TOOLBAR
    | typeof ANALYTICS_SURFACE.CONTEXT_MENU
    | typeof ANALYTICS_SURFACE.SHORTCUT
}

async function getSelectionWebPagePromptContext(
  providerConfig: ProviderConfig,
  enableAIContentAware: boolean,
) {
  const webPageContext = await getOrCreateWebPageContext()
  if (!webPageContext) {
    return undefined
  }

  const webSummary = isLLMProviderConfig(providerConfig)
    ? await getOrGenerateWebPageSummary(
        webPageContext,
        { kind: "local", config: providerConfig },
        enableAIContentAware,
        "selectionTranslation",
      )
    : null
  return {
    webTitle: webPageContext.webTitle,
    webDescription: webPageContext.webDescription,
    webContent: webPageContext.webContent,
    webSummary: webSummary ?? undefined,
  }
}

async function translateWithTextStream({
  preparedText,
  providerId,
  providerConfig,
  translateRequest,
  onChunk,
  registerAbortController,
}: {
  preparedText: string
  providerId: string
  providerConfig: LLMProviderConfig
  translateRequest: SelectionToolbarTranslateRequestSlice
  onChunk: (data: BackgroundTextStreamSnapshot) => void
  registerAbortController: (abortController: AbortController) => void
}) {
  const targetLangName = LANG_CODE_TO_EN_NAME[translateRequest.language.targetCode]
  const modelName = resolveModelId(providerConfig.model)
  const reasoning = getTopLevelReasoning(providerConfig)
  const providerOptions = getProviderOptionsWithOverride(
    modelName ?? "",
    providerConfig.provider,
    providerConfig.providerOptions,
    reasoning,
  )
  const temperature = providerConfig.temperature
  const abortController = new AbortController()
  registerAbortController(abortController)

  const throwIfAborted = () => {
    if (abortController.signal.aborted) {
      throw new DOMException("aborted", "AbortError")
    }
  }

  const webPageContext = await getSelectionWebPagePromptContext(
    providerConfig,
    translateRequest.enableAIContentAware,
  )
  throwIfAborted()
  const glossaryTerms = resolveGlossaryTermsFromCache(
    preparedText,
    translateRequest.glossaryEnabled,
    translateRequest.language.targetCode,
  )
  trackGlossaryUsed(
    "selectionTranslation",
    glossaryTerms,
    translateRequest.language.targetCode,
    classifyProviderConfig(providerConfig),
  )
  const { systemPrompt, prompt } = getTranslatePromptFromConfig(
    { customPromptsConfig: translateRequest.customPromptsConfig },
    targetLangName,
    preparedText,
    {
      ...(webPageContext
        ? {
            context: {
              webTitle: webPageContext.webTitle,
              webDescription: webPageContext.webDescription,
              webContent: webPageContext.webContent,
              webSummary: webPageContext.webSummary,
            },
          }
        : {}),
      glossaryTerms,
    },
  )

  const translatedText = await streamBackgroundText(
    {
      providerKind: "local",
      providerId,
      instructions: systemPrompt,
      prompt,
      providerOptions,
      reasoning,
      temperature,
    },
    {
      signal: abortController.signal,
      onChunk,
    },
  )

  return translatedText
}

async function translateWithStandardProvider({
  text,
  providerConfig,
  translateRequest,
}: {
  text: string
  providerConfig: TranslateProviderConfig
  translateRequest: SelectionToolbarTranslateRequestSlice
}) {
  const webPageContext = await getSelectionWebPagePromptContext(
    providerConfig,
    translateRequest.enableAIContentAware,
  )
  const translatedText = await translateTextCore({
    text,
    langConfig: translateRequest.language,
    hostedFeature: "selectionTranslation",
    providerConfig: {
      kind: "local",
      config: providerConfig,
      id: providerConfig.id,
      name: providerConfig.name,
    },
    glossaryEnabled: translateRequest.glossaryEnabled,
    enableAIContentAware: translateRequest.enableAIContentAware,
    extraHashTags: ["selectionTranslation"],
    webPageContext,
  })

  return translatedText
}

export function useSelectionTranslationController() {
  const [isOpen, setIsOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [popoverSessionKey, setPopoverSessionKey] = useState(0)
  const [translatedText, setTranslatedText] = useState<string | undefined>(undefined)
  const [thinking, setThinking] = useState<ThinkingSnapshot | null>(null)
  const [error, setError] = useState<SelectionToolbarInlineError | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [rerunNonce, setRerunNonce] = useState(0)
  const [sourceSurface, setSourceSurface] = useState<
    | typeof ANALYTICS_SURFACE.SELECTION_TOOLBAR
    | typeof ANALYTICS_SURFACE.CONTEXT_MENU
    | typeof ANALYTICS_SURFACE.SHORTCUT
  >(ANALYTICS_SURFACE.SELECTION_TOOLBAR)
  const [activeSession, setActiveSession] = useState<SelectionSession | null>(null)
  const selectionSession = useAtomValue(selectionSessionAtom)
  const translateRequest = useAtomValue(selectionToolbarTranslateRequestAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pendingOpenRequestRef = useRef<SelectionTranslatePendingOpenRequest | null>(null)
  const popoverActionsRef = useRef<SelectionPopoverActions | null>(null)
  const lastTranslationRunKeyRef = useRef<string | null>(null)
  const runIdRef = useRef(0)
  const { resolveContextMenuOpenRequest, resolveShortcutOpenRequest } =
    useSelectionOpenRequestResolver(selectionSession)
  const selectionText = activeSession?.selectionSnapshot.text ?? null
  const paragraphsText = activeSession?.contextSnapshot.text ?? selectionText
  const titleText = getSourceDocumentTitle() || null
  const translateProviders = useMemo(
    () => getSelectableProvidersForCapability("selectionTranslation", providersConfig),
    [providersConfig],
  )
  const translateRequestKey = useMemo(() => JSON.stringify(translateRequest), [translateRequest])

  const resetPopoverSession = useCallback((options?: { clearAnchor?: boolean }) => {
    setActiveSession(null)
    if (options?.clearAnchor) {
      setAnchor(null)
    }
  }, [])

  const resetTranslationState = useCallback(() => {
    setIsTranslating(false)
    setTranslatedText(undefined)
    setThinking(null)
    setError(null)
  }, [])

  const cancelCurrentTranslation = useCallback((runId?: number) => {
    if (runId !== undefined && runIdRef.current !== runId) {
      return
    }

    runIdRef.current += 1
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  const commitOpenRequest = useCallback((request: SelectionTranslatePendingOpenRequest) => {
    pendingOpenRequestRef.current = request
  }, [])

  const handleProviderChange = useCallback(
    (providerId: string) => {
      void setConfig(buildFeatureProviderPatch({ selectionTranslation: providerId }))
    },
    [setConfig],
  )

  const handleRegenerate = useCallback(() => {
    cancelCurrentTranslation()
    setRerunNonce((prev) => prev + 1)
  }, [cancelCurrentTranslation])

  const runTranslation = useCallback(
    async (runId: number) => {
      const preparedText = prepareTranslationText(selectionText)

      if (preparedText === "") {
        if (runIdRef.current === runId) {
          resetTranslationState()
        }
        return
      }

      const analyticsContext = {
        ...createFeatureUsageContext(ANALYTICS_FEATURE.SELECTION_TRANSLATION, sourceSurface),
        char_count: preparedText.length,
        target_language: translateRequest.language.targetCode,
      }
      // 上游 v1.43.6 给 feature_used 事件加了 provider / backend_kind 必填项。provider 要到
      // 下面解析出 providerConfig 才知道，而失败分支可能在那之前就上报，故先置未知、解析后再覆盖。
      let analyticsProvider: FeatureProviderAnalytics = UNKNOWN_FEATURE_PROVIDER
      setIsTranslating(true)
      setTranslatedText(undefined)
      setThinking(null)
      setError(null)

      const provider = translateRequest.provider
      if (!provider) {
        if (runIdRef.current === runId) {
          setIsTranslating(false)
          setError(createSelectionToolbarPrecheckError("translate", "providerUnavailable"))
        }
        void trackFeatureUsed({
          ...analyticsContext,
          ...analyticsProvider,
          outcome: "failure",
        })
        return
      }

      if (provider.kind === "local" && !provider.config.enabled) {
        if (runIdRef.current === runId) {
          setIsTranslating(false)
          setError(createSelectionToolbarPrecheckError("translate", "providerDisabled"))
        }
        void trackFeatureUsed({
          ...analyticsContext,
          ...analyticsProvider,
          outcome: "failure",
        })
        return
      }

      try {
        if (provider.kind !== "local") {
          if (runIdRef.current === runId) {
            setIsTranslating(false)
            setError(createSelectionToolbarPrecheckError("translate", "providerUnavailable"))
          }
          void trackFeatureUsed({
            ...analyticsContext,
            ...analyticsProvider,
            outcome: "failure",
          })
          return
        }

        const providerConfig = provider.config
        analyticsProvider = classifyProviderConfig(providerConfig)
        if (!isTranslateProviderConfig(providerConfig)) {
          if (runIdRef.current === runId) {
            setIsTranslating(false)
            setError(createSelectionToolbarPrecheckError("translate", "providerUnavailable"))
          }
          void trackFeatureUsed({
            ...analyticsContext,
            ...analyticsProvider,
            outcome: "failure",
          })
          return
        }

        let nextTranslatedText = ""
        if (isLLMProviderConfig(providerConfig)) {
          setThinking({
            status: "thinking",
            text: "",
          })

          const nextSnapshot = await translateWithTextStream({
            preparedText,
            providerId: providerConfig.id,
            providerConfig,
            translateRequest,
            onChunk: (data) => {
              if (runIdRef.current === runId) {
                setTranslatedText(data.output)
                setThinking(data.thinking)
              }
            },
            registerAbortController: (abortController) => {
              abortControllerRef.current = abortController
            },
          })

          nextTranslatedText = nextSnapshot.output
          if (runIdRef.current === runId) {
            setThinking(nextSnapshot.thinking)
          }
        } else {
          setThinking(null)
          nextTranslatedText = await translateWithStandardProvider({
            text: preparedText,
            providerConfig,
            translateRequest,
          })
        }

        if (runIdRef.current === runId) {
          setTranslatedText(nextTranslatedText)
        }

        void trackFeatureUsed({
          ...analyticsContext,
          ...analyticsProvider,
          outcome: "success",
        })
      } catch (caughtError) {
        if (!isAbortError(caughtError) && runIdRef.current === runId) {
          setThinking((prev) => (prev?.text ? { ...prev, status: "complete" } : null))
          setError(createSelectionToolbarRuntimeError("translate", caughtError))
        }

        if (!isAbortError(caughtError)) {
          void trackFeatureUsed({
            ...analyticsContext,
            ...analyticsProvider,
            outcome: "failure",
          })
        }
      } finally {
        if (runIdRef.current === runId) {
          abortControllerRef.current = null
          setIsTranslating(false)
        }
      }
    },
    [resetTranslationState, selectionText, sourceSurface, translateRequest],
  )

  const startTranslation = useEffectEvent((runId: number) => {
    void runTranslation(runId)
  })

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const nextRunKey = JSON.stringify({
      popoverSessionKey,
      rerunNonce,
      sessionId: activeSession?.id ?? null,
      translateRequestKey,
    })
    if (lastTranslationRunKeyRef.current === nextRunKey) {
      return undefined
    }
    lastTranslationRunKeyRef.current = nextRunKey

    const runId = runIdRef.current + 1
    runIdRef.current = runId

    startTranslation(runId)

    return () => {
      cancelCurrentTranslation(runId)
    }
  }, [
    activeSession?.id,
    cancelCurrentTranslation,
    isOpen,
    popoverSessionKey,
    rerunNonce,
    translateRequestKey,
  ])

  const applyPendingSession = useCallback(() => {
    const pendingRequest = pendingOpenRequestRef.current
    const nextSession = pendingRequest?.session ?? selectionSession
    setActiveSession(
      nextSession
        ? {
            ...nextSession,
            contextSnapshot:
              captureSelectionActionContext(nextSession.selectionSnapshot) ??
              nextSession.contextSnapshot,
          }
        : null,
    )
    setSourceSurface(pendingRequest?.surface ?? ANALYTICS_SURFACE.SELECTION_TOOLBAR)
    setIsSelectionToolbarVisible(false)
    pendingOpenRequestRef.current = null
  }, [selectionSession, setIsSelectionToolbarVisible])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      cancelCurrentTranslation()
      resetTranslationState()
      if (nextOpen) {
        setPopoverSessionKey((previous) => previous + 1)
        applyPendingSession()
      } else {
        resetPopoverSession({ clearAnchor: pendingOpenRequestRef.current === null })
        lastTranslationRunKeyRef.current = null
      }
      setIsOpen(nextOpen)
    },
    [applyPendingSession, cancelCurrentTranslation, resetPopoverSession, resetTranslationState],
  )

  const handleReuseRequest = useCallback(() => {
    cancelCurrentTranslation()
    resetTranslationState()
    applyPendingSession()
    setRerunNonce((previous) => previous + 1)
  }, [applyPendingSession, cancelCurrentTranslation, resetTranslationState])

  const prepareToolbarOpen = useCallback(() => {
    if (!selectionSession) {
      return
    }

    commitOpenRequest({
      session: selectionSession,
      surface: ANALYTICS_SURFACE.SELECTION_TOOLBAR,
    })
  }, [commitOpenRequest, selectionSession])

  const resolveContextMenuRequest = useCallback((): SelectionTranslatePendingOpenRequest | null => {
    const request = resolveContextMenuOpenRequest()
    if (!request) {
      return null
    }

    return {
      anchor: request.anchor,
      session: request.session,
      surface: ANALYTICS_SURFACE.CONTEXT_MENU,
    }
  }, [resolveContextMenuOpenRequest])

  const resolveShortcutRequest = useCallback(
    (session: SelectionSession | null): SelectionTranslatePendingOpenRequest | null => {
      const request = resolveShortcutOpenRequest(session)
      if (!request) {
        return null
      }

      return {
        anchor: request.anchor,
        session: request.session,
        surface: ANALYTICS_SURFACE.SHORTCUT,
      }
    },
    [resolveShortcutOpenRequest],
  )

  const openSelectionTranslationRequest = useCallback(
    (
      request: SelectionTranslatePendingOpenRequest | null,
      options?: { showMissingSelectionToast?: boolean },
    ) => {
      if (!request) {
        if (options?.showMissingSelectionToast) {
          const nextError = createSelectionToolbarPrecheckError("translate", "missingSelection")
          toastManager.add({ type: "error", title: nextError.description })
        }
        return
      }

      commitOpenRequest(request)
      popoverActionsRef.current?.requestOpen(request.anchor ?? null)
    },
    [commitOpenRequest],
  )

  const openFromContextMenu = useCallback(() => {
    openSelectionTranslationRequest(resolveContextMenuRequest(), {
      showMissingSelectionToast: true,
    })
  }, [openSelectionTranslationRequest, resolveContextMenuRequest])

  useSelectionShortcuts(
    {
      translate: selectionToolbar.features.translate.enabled
        ? selectionToolbar.features.translate.shortcut
        : undefined,
    },
    (_, session) => {
      const request = resolveShortcutRequest(session)
      if (!request) return false
      openSelectionTranslationRequest(request)
      return true
    },
  )

  useEffect(() => {
    return onMessage("openSelectionTranslationFromContextMenu", () => {
      openFromContextMenu()
    })
  }, [openFromContextMenu])

  return {
    isOpen,
    anchor,
    setAnchor,
    popoverSessionKey,
    selectionText,
    translatedText,
    thinking,
    error,
    isTranslating,
    paragraphsText,
    titleText,
    translateProviders,
    translateRequest,
    popoverActionsRef,
    handleOpenChange,
    handleReuseRequest,
    handleProviderChange,
    handleRegenerate,
    prepareToolbarOpen,
  }
}
