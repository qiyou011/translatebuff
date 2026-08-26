import type { SelectionSession } from "@/entrypoints/selection.content/selection-toolbar/atoms"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import {
  contextAtom,
  isSelectionToolbarVisibleAtom,
  selectionAtom,
  selectionSessionAtom,
} from "@/entrypoints/selection.content/selection-toolbar/atoms"
import {
  buildCustomActionExecutionPlan,
  useCustomActionExecution,
  useCustomActionWebPageContext,
} from "@/entrypoints/selection.content/selection-toolbar/custom-action-button/use-custom-action-execution"
import { createSelectionToolbarPrecheckError } from "@/entrypoints/selection.content/selection-toolbar/inline-error"
import { useSelectionOpenRequestResolver } from "@/entrypoints/selection.content/selection-toolbar/use-selection-open-request"
import { normalizeSelectedText } from "@/entrypoints/selection.content/utils"
import { withRenyimiaoJsonObjectFormat } from "@/fork/providers/custom-action-response-format"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { getSelectionToolbarActions, patchSelectionToolbarAction } from "@/utils/custom-actions"
import { onMessage } from "@/utils/message"
import {
  getSelectableProvidersForCapability,
  resolveProviderRefForCapability,
} from "@/utils/providers/provider-registry"

// fork 自定义动作 controller —— 逐行镜像上游 custom-action-button/provider.tsx 的编排状态机
// （provider body :67-381），return 全部态 + handlers 供薄壳组合 JSX。
// 执行引擎（buildCustomActionExecutionPlan / useCustomActionExecution / useCustomActionWebPageContext
// / provider-registry / config atoms / atoms.ts …）全部 import 上游，不复制引擎本体。
// 已删除：所有「保存到笔记库」相关行——不读弹窗开关 atom、不渲染其按钮/弹窗宿主（见 design D5）。
// 同步纪律：diff 上游 provider.tsx → 把 delta 搬到本文件；结构 1:1，机械低认知。

interface SelectionCustomActionPendingOpenRequest {
  actionId: string
  anchor?: { x: number; y: number }
  session: SelectionSession | null
  surface: typeof ANALYTICS_SURFACE.SELECTION_TOOLBAR | typeof ANALYTICS_SURFACE.CONTEXT_MENU
}

export function useSelectionCustomActionController() {
  const [isOpen, setIsOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [popoverSessionKey, setPopoverSessionKey] = useState(0)
  const [rerunNonce, setRerunNonce] = useState(0)
  const [activeSession, setActiveSession] = useState<SelectionSession | null>(null)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [sourceSurface, setSourceSurface] = useState<
    typeof ANALYTICS_SURFACE.SELECTION_TOOLBAR | typeof ANALYTICS_SURFACE.CONTEXT_MENU
  >(ANALYTICS_SURFACE.SELECTION_TOOLBAR)
  const selectionSession = useAtomValue(selectionSessionAtom)
  const selection = useAtomValue(selectionAtom)
  const context = useAtomValue(contextAtom)
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const language = useAtomValue(configFieldsAtomMap.language)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const bodyRef = useRef<HTMLDivElement>(null)
  const pendingOpenRequestRef = useRef<SelectionCustomActionPendingOpenRequest | null>(null)
  const reopenFrameRef = useRef<number | null>(null)
  const nextEphemeralSessionIdRef = useRef(0)
  const trackedPrecheckErrorKeyRef = useRef<string | null>(null)
  const { resolveContextMenuOpenRequest } = useSelectionOpenRequestResolver(selectionSession)
  const selectionText = activeSession?.selectionSnapshot.text ?? null
  const cleanSelection = useMemo(() => normalizeSelectedText(selectionText), [selectionText])
  const paragraphsText = useMemo(() => {
    if (!cleanSelection) {
      return ""
    }

    return activeSession?.contextSnapshot.text || cleanSelection
  }, [activeSession?.contextSnapshot.text, cleanSelection])
  const webPageContext = useCustomActionWebPageContext(isOpen, popoverSessionKey)
  const titleText = (webPageContext?.webTitle ?? document.title) || null
  const activeAction = useMemo(
    () =>
      getSelectionToolbarActions(selectionToolbarConfig).find(
        (action) => action.enabled !== false && action.id === activeActionId,
      ) ?? null,
    [activeActionId, selectionToolbarConfig],
  )
  const customActionRequest = useMemo(
    () => ({
      language,
      action: activeAction,
      // fork：词典 provider 引用过降级 helper——把结构化输出的 response_format 从 json_schema 降到
      // json_object（任译喵网关支持），只作用于本瞬时引用、不落 config，普通翻译不受影响。
      provider: activeAction
        ? withRenyimiaoJsonObjectFormat(
            resolveProviderRefForCapability(
              "customAction",
              providersConfig,
              activeAction.providerId,
            ),
          )
        : null,
    }),
    [activeAction, language, providersConfig],
  )
  const customActionProviders = useMemo(
    () => getSelectableProvidersForCapability("customAction", providersConfig),
    [providersConfig],
  )
  const executionPlan = useMemo(
    () =>
      buildCustomActionExecutionPlan(
        customActionRequest,
        cleanSelection,
        paragraphsText,
        webPageContext,
      ),
    [cleanSelection, customActionRequest, paragraphsText, webPageContext],
  )
  const { error, isRunning, resetSessionState, result, thinking } = useCustomActionExecution({
    bodyRef,
    analyticsSurface: sourceSurface,
    executionContext: executionPlan.executionContext,
    open: isOpen,
    popoverSessionKey,
    rerunNonce,
  })
  const displayedResult = executionPlan.executionContext ? result : null
  const displayedError = error ?? executionPlan.error
  const displayedIsRunning =
    (isOpen && webPageContext === undefined) || (executionPlan.executionContext ? isRunning : false)
  const displayedThinking = executionPlan.executionContext ? thinking : null

  const resetPopoverSession = useCallback((options?: { clearAnchor?: boolean }) => {
    setActiveSession(null)
    setActiveActionId(null)
    if (options?.clearAnchor) {
      setAnchor(null)
    }
  }, [])

  const commitOpenRequest = useCallback((request: SelectionCustomActionPendingOpenRequest) => {
    pendingOpenRequestRef.current = request
    if (request.anchor) {
      setAnchor(request.anchor)
    }
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      resetSessionState()

      if (nextOpen) {
        const pendingRequest = pendingOpenRequestRef.current
        const nextSession = pendingRequest?.session ?? selectionSession

        setActiveSession(nextSession)
        setActiveActionId(pendingRequest?.actionId ?? null)
        setSourceSurface(pendingRequest?.surface ?? ANALYTICS_SURFACE.SELECTION_TOOLBAR)
        setPopoverSessionKey((prev) => prev + 1)
        if (pendingRequest?.anchor) {
          setAnchor(pendingRequest.anchor)
        }
        setIsSelectionToolbarVisible(false)
        pendingOpenRequestRef.current = null
      } else {
        resetPopoverSession({
          clearAnchor: pendingOpenRequestRef.current === null,
        })
      }

      setIsOpen(nextOpen)
    },
    [resetPopoverSession, resetSessionState, selectionSession, setIsSelectionToolbarVisible],
  )

  const openActionRequest = useCallback(
    (request: SelectionCustomActionPendingOpenRequest) => {
      if (isOpen) {
        handleOpenChange(false)

        if (reopenFrameRef.current !== null) {
          cancelAnimationFrame(reopenFrameRef.current)
        }

        reopenFrameRef.current = requestAnimationFrame(() => {
          reopenFrameRef.current = null
          commitOpenRequest(request)
          handleOpenChange(true)
        })
        return
      }

      commitOpenRequest(request)
      handleOpenChange(true)
    },
    [commitOpenRequest, handleOpenChange, isOpen],
  )

  const openToolbarCustomAction = useCallback(
    (actionId: string, triggerElement: HTMLElement | null) => {
      if (!triggerElement) {
        return
      }

      const rect = triggerElement.getBoundingClientRect()
      openActionRequest({
        actionId,
        anchor: { x: rect.left, y: rect.top },
        surface: ANALYTICS_SURFACE.SELECTION_TOOLBAR,
        session:
          selectionSession ??
          (selection
            ? {
                id: --nextEphemeralSessionIdRef.current,
                createdAt: Date.now(),
                selectionSnapshot: selection,
                contextSnapshot: context ?? {
                  text: "",
                  paragraphs: [],
                },
              }
            : null),
      })
    },
    [context, openActionRequest, selection, selectionSession],
  )

  const openContextMenuCustomAction = useCallback(
    (actionId: string) => {
      const action = getSelectionToolbarActions(selectionToolbarConfig).find(
        (candidate) => candidate.enabled !== false && candidate.id === actionId,
      )
      if (!action) {
        const nextError = createSelectionToolbarPrecheckError("customAction", "actionUnavailable")
        void trackFeatureUsed({
          ...createFeatureUsageContext(
            ANALYTICS_FEATURE.CUSTOM_AI_ACTION,
            ANALYTICS_SURFACE.CONTEXT_MENU,
            Date.now(),
            {
              action_id: actionId,
            },
          ),
          // 前置校验失败，provider 尚未解析，按上游约定回落 UNKNOWN
          ...UNKNOWN_FEATURE_PROVIDER,
          outcome: "failure",
        })
        toastManager.add({ type: "error", title: nextError.description })
        return
      }

      const request = resolveContextMenuOpenRequest()
      if (!request) {
        const nextError = createSelectionToolbarPrecheckError("customAction", "missingSelection")
        void trackFeatureUsed({
          ...createFeatureUsageContext(
            ANALYTICS_FEATURE.CUSTOM_AI_ACTION,
            ANALYTICS_SURFACE.CONTEXT_MENU,
            Date.now(),
            {
              action_id: action.id,
              action_name: action.name,
            },
          ),
          // 前置校验失败，provider 尚未解析，按上游约定回落 UNKNOWN
          ...UNKNOWN_FEATURE_PROVIDER,
          outcome: "failure",
        })
        toastManager.add({ type: "error", title: nextError.description })
        return
      }

      openActionRequest({
        actionId: action.id,
        anchor: request.anchor,
        session: request.session,
        surface: ANALYTICS_SURFACE.CONTEXT_MENU,
      })
    },
    [openActionRequest, resolveContextMenuOpenRequest, selectionToolbarConfig],
  )

  const handleProviderChange = useCallback(
    (providerId: string) => {
      if (!activeActionId) {
        return
      }

      // 内置词典已不在 customActions 里，直接 map 那个数组会静默改不到它。
      // patchSelectionToolbarAction 会按 id 落到正确的位置（内置 → builtInActions，自定义 → customActions）。
      void setConfig({
        selectionToolbar: patchSelectionToolbarAction(selectionToolbarConfig, activeActionId, {
          providerId,
        }),
      })
    },
    [activeActionId, selectionToolbarConfig, setConfig],
  )

  const handleRegenerate = useCallback(() => {
    setRerunNonce((prev) => prev + 1)
  }, [])

  useEffect(() => {
    return onMessage("openSelectionCustomActionFromContextMenu", (message) => {
      openContextMenuCustomAction(message.data.actionId)
    })
  }, [openContextMenuCustomAction])

  useEffect(() => {
    return () => {
      if (reopenFrameRef.current !== null) {
        cancelAnimationFrame(reopenFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !executionPlan.error || executionPlan.executionContext) {
      return
    }

    const analyticsContext = createFeatureUsageContext(
      ANALYTICS_FEATURE.CUSTOM_AI_ACTION,
      sourceSurface,
      Date.now(),
      {
        action_id: activeActionId ?? undefined,
        action_name: activeAction?.name,
      },
    )
    const nextErrorKey = JSON.stringify({
      actionId: analyticsContext.action_id ?? null,
      description: executionPlan.error.description,
      popoverSessionKey,
      surface: sourceSurface,
    })

    if (trackedPrecheckErrorKeyRef.current === nextErrorKey) {
      return
    }
    trackedPrecheckErrorKeyRef.current = nextErrorKey

    void trackFeatureUsed({
      ...analyticsContext,
      // 前置校验失败，provider 尚未解析，按上游约定回落 UNKNOWN
      ...UNKNOWN_FEATURE_PROVIDER,
      outcome: "failure",
    })
  }, [
    activeAction?.name,
    activeActionId,
    executionPlan.error,
    executionPlan.executionContext,
    isOpen,
    popoverSessionKey,
    sourceSurface,
  ])

  return {
    isOpen,
    anchor,
    setAnchor,
    popoverSessionKey,
    bodyRef,
    activeAction,
    selectionText,
    paragraphsText,
    titleText,
    customActionProviders,
    customActionRequest,
    displayedResult,
    displayedError,
    displayedIsRunning,
    displayedThinking,
    handleOpenChange,
    handleProviderChange,
    handleRegenerate,
    openToolbarCustomAction,
  }
}
