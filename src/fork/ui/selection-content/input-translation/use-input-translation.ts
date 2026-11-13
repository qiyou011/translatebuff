import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { InputTranslationError } from "./input-translation-error"
import type { InputPlatformSession } from "./platforms/session"
import type { InputTranslationLang } from "@/types/config/config"
import { useAtomValue } from "jotai"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { isLexicalElement } from "@/entrypoints/input-injector.content/editors/lexical"
import { featureConfigAtom } from "@/fork/config/atoms"
import { resolveFeatureConfig } from "@/fork/config/feature-config"
import { readFeatureConfig } from "@/fork/config/storage"
import { UpstreamCloudDisabledError } from "@/fork/upstream-services/disabled-error"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureAttempt } from "@/utils/analytics"
import { classifyResolvedProvider } from "@/utils/analytics-provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { INPUT_REPLACE_REQUEST_TYPE } from "@/utils/constants/input-injector"
import { getDeepActiveElement } from "@/utils/dom/active-element"
import { HostedAiProviderUnavailableError } from "@/utils/providers/provider-ref"
import {
  isBuiltInAiProviderId,
  resolveProviderRefForCapability,
} from "@/utils/providers/provider-registry"
import { getChatContextSelector } from "./chat-context-sites"
import { executeInputTranslation } from "./execute-input-translation"
import { classifyInputTranslationError } from "./input-translation-error"
import { captureInputPlatformSession } from "./platforms"
import { replaceTelegramDraft } from "./replace-telegram-draft"
import { resolveInputTranslationLang } from "./resolve-lang"
import {
  getTelegramSessionKey,
  isTelegramUrl,
  TELEGRAM_DRAFT_VERSION_ATTR,
} from "./telegram-context"

const SPACE_KEY = " "
const SEND_CONFIRMATION_WINDOW_MS = 1000
/** Hammering the hotkey must stack one toast, not one per attempt. */
const HOSTED_UNAVAILABLE_TOAST_ID = "input-translation-hosted-unavailable"

/**
 * Set text content with undo support using execCommand.
 * This allows Ctrl+Z to restore the original text.
 */
function setTextWithUndo(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  text: string,
) {
  element.focus()

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // Select all text in input/textarea
    element.select()
    document.execCommand("insertText", false, text)
    element.dispatchEvent(new Event("input", { bubbles: true }))
    return
  }

  if (element.isContentEditable) {
    window.postMessage({ type: INPUT_REPLACE_REQUEST_TYPE, text }, window.location.origin)
  }
}

function getEditableText(element: HTMLInputElement | HTMLTextAreaElement | HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value
  }
  // innerText preserves rich-editor paragraph and <br> boundaries (including Reddit).
  return element.innerText ?? element.textContent ?? ""
}

function eventComesFrom(event: Event, element: HTMLElement | null): boolean {
  if (!element) return false
  return event.composedPath().some((target) => {
    return target === element || (target instanceof Node && element.contains(target))
  })
}

function hasFocusWithin(element: HTMLElement, interactionElement: HTMLElement | null): boolean {
  const activeElement = getDeepActiveElement()
  if (
    activeElement &&
    (activeElement === element ||
      element.contains(activeElement) ||
      interactionElement?.contains(activeElement))
  ) {
    return true
  }

  const interactionRoot = interactionElement?.getRootNode()
  const shadowActiveElement =
    interactionRoot instanceof ShadowRoot ? interactionRoot.activeElement : null
  return shadowActiveElement ? (interactionElement?.contains(shadowActiveElement) ?? false) : false
}

/** 这次的语言是怎么定的，界面据此显示「自动检测」／「按网页源语言」／「手动选择」。 */
export type InputTranslationBarSource = "configured" | "manual"

export type InputTranslationFeedback =
  | { kind: "pending" }
  | ({ kind: "error" } & InputTranslationError)
type TranslationDirection = { fromLang: InputTranslationLang; toLang: InputTranslationLang }

/**
 * 输入框上方那条的两种形态。
 *
 * 必须记住 `element` 而不只是文本：同一个页面上主输入框、消息编辑框、搜索框同时存在，
 * 只记文本会把 A 框的原文撤销进 B 框。
 */
export type InputTranslationBar = (
  | {
      kind: "translated"
      element: HTMLInputElement | HTMLTextAreaElement | HTMLElement
      sessionKey?: string
      translatedText?: string
      originalText: string
      /** 翻译方向的来源端，改语言重译时照旧用它。 */
      fromCode: LangCodeISO6393
      lang: LangCodeISO6393
      langSource: InputTranslationBarSource
      pendingLang?: LangCodeISO6393
      feedback?: InputTranslationFeedback
    }
  | {
      kind: "initial"
      element: HTMLElement
      sessionKey?: string
      originalText: string
      direction: TranslationDirection
      feedback: InputTranslationFeedback
    }
  /** 两端同语言、什么都没换。同一位置、同款外观，但没有可撤销的对象。 */
  | { kind: "sameLanguage"; element: HTMLElement; lang: LangCodeISO6393; sessionKey?: string }
  | { kind: "hint"; element: HTMLElement; sessionKey?: string }
) & { ownership?: InputPlatformSession | null }

type InputTranslationBarState = {
  bar: InputTranslationBar
  isVisible: boolean
}

type PendingInputRequest = {
  revision?: string
  element: HTMLElement
  valid: () => boolean
  finish: () => void
  cancel: () => void
  settle: (commit: () => void) => void
  deferred: (() => void) | null
}

export function useInputTranslation() {
  const featureConfig = useAtomValue(featureConfigAtom)
  const triggerCount = featureConfig?.forkConfig.inputTranslation.triggerCount ?? 2
  const inputTranslationConfig = useAtomValue(configFieldsAtomMap.inputTranslation)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const spaceTimestampsRef = useRef<number[]>([])
  const requestRef = useRef<PendingInputRequest | null>(null)
  const configRevisionRef = useRef(featureConfig?.revision)
  useLayoutEffect(() => {
    if (configRevisionRef.current !== featureConfig?.revision) {
      configRevisionRef.current = featureConfig?.revision
      requestRef.current?.cancel()
    }
  }, [featureConfig?.revision])
  const writeIdRef = useRef(0)
  const writingElementRef = useRef<HTMLElement | null>(null)
  const triggerSnapshotRef = useRef<{ element: HTMLElement; text: string } | null>(null)
  const interactionElementRef = useRef<HTMLElement | null>(null)
  const languageMenuOpenRef = useRef(false)
  const [barState, setBarState] = useState<InputTranslationBarState | null>(null)
  const stateRef = useRef<InputTranslationBarState | null>(null)
  const updateState = useCallback(
    (update: (state: InputTranslationBarState | null) => InputTranslationBarState | null) => {
      stateRef.current = update(stateRef.current)
      setBarState(stateRef.current)
    },
    [],
  )
  const publish = useCallback(
    (next: InputTranslationBar | null) => {
      updateState(() =>
        next
          ? {
              bar: {
                ...next,
                ownership: next.ownership ?? captureInputPlatformSession(next.element),
              },
              isVisible: hasFocusWithin(next.element, interactionElementRef.current),
            }
          : null,
      )
    },
    [updateState],
  )
  // `bar` 是仍然存活的翻译会话；`barState.isVisible` 只控制 UI。真正失焦时两者不能一起清空，
  // 否则重新聚焦原输入框时会丢失 originalText，也无法恢复撤销入口。
  const bar = barState?.bar ?? null

  // The request owns its listeners. Logical cancellation deliberately does not
  // change the upstream transport; a late finally can only clean its own resources.
  const beginRequest = useCallback(
    (element: HTMLElement, onCancel: () => void) => {
      const draft = getEditableText(element)
      const url = window.location.href
      const telegramKey = isTelegramUrl(url) ? getTelegramSessionKey(url, element) : undefined
      const ownership = captureInputPlatformSession(element)
      const cleanup: Array<() => void> = []
      const request: PendingInputRequest = {
        element,
        deferred: null,
        valid: () =>
          requestRef.current === request &&
          (request.revision === undefined ||
            configRevisionRef.current === undefined ||
            configRevisionRef.current === request.revision) &&
          element.isConnected &&
          window.location.href === url &&
          (!ownership || ownership.isCurrent()) &&
          (telegramKey === undefined || getTelegramSessionKey(url, element) === telegramKey) &&
          getEditableText(element) === draft,
        finish: () => {
          request.deferred = null
          cleanup.splice(0).forEach((dispose) => dispose())
          if (requestRef.current === request) requestRef.current = null
        },
        cancel: () => {
          if (requestRef.current !== request) return
          request.finish()
          if (!element.isConnected || window.location.href !== url) publish(null)
          else onCancel()
        },
        settle: (commit) => {
          if (!request.valid()) {
            request.cancel()
            return
          }
          const apply = () => {
            if (!request.valid()) {
              request.cancel()
              return
            }
            if (!hasFocusWithin(element, interactionElementRef.current)) return
            // Remove our input listener before the intentional extension write.
            request.finish()
            commit()
          }
          request.deferred = apply
          apply()
        },
      }
      requestRef.current = request
      const listen = (target: EventTarget, type: string, handler: EventListener) => {
        target.addEventListener(type, handler, true)
        cleanup.push(() => target.removeEventListener(type, handler, true))
      }
      listen(element, "input", () => request.cancel())
      listen(document, "focusin", () => request.deferred?.())
      listen(document, "keydown", (event) => {
        const key = event as KeyboardEvent
        if (
          key.key === "Escape" &&
          !languageMenuOpenRef.current &&
          (eventComesFrom(event, element) || eventComesFrom(event, interactionElementRef.current))
        ) {
          request.cancel()
          publish(null)
        }
      })
      listen(document, "submit", (event) => {
        if (event.target instanceof HTMLFormElement && event.target.contains(element)) {
          request.cancel()
          publish(null)
        }
      })
      listen(window, "popstate", () => {
        if (!request.valid()) request.cancel()
      })
      listen(window, "hashchange", () => {
        if (!request.valid()) request.cancel()
      })
      // Observe only child-list changes along the editor's ancestor chain, not the
      // entire Discord message subtree. Removing any ancestor invalidates ownership.
      const observer = new MutationObserver(() => {
        if (!request.valid()) request.cancel()
      })
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        observer.observe(parent, { childList: true })
      }
      if (ownership)
        observer.observe(ownership.root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-id", "data-list-key", "data-peer-id", "thingid", "title"],
        })
      cleanup.push(() => observer.disconnect())
      return request
    },
    [publish],
  )

  useEffect(
    () => () => {
      requestRef.current?.finish()
      writeIdRef.current++
      writingElementRef.current = null
    },
    [],
  )

  const handleTranslation = useCallback(
    async (
      element: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
      retryBar?: Extract<InputTranslationBar, { kind: "initial" }>,
    ) => {
      if (requestRef.current?.element === element) return
      if (writingElementRef.current === element) return
      writeIdRef.current++
      writingElementRef.current = null
      requestRef.current?.cancel()

      // Security: skip password fields to prevent exposing sensitive data
      if (element instanceof HTMLInputElement && element.type === "password") {
        return
      }

      const text = getEditableText(element).trim()
      if (!text || !element.isConnected) return
      const url = window.location.href
      const telegram = isTelegramUrl(url)
      const ownership = captureInputPlatformSession(element)
      const sessionKey = telegram ? (getTelegramSessionKey(url, element) ?? undefined) : undefined
      if (telegram && !sessionKey) return
      const originalText =
        retryBar?.originalText ??
        (triggerSnapshotRef.current?.element === element
          ? triggerSnapshotRef.current.text
          : getEditableText(element))
      const reddit = /(^|\.)reddit\.com$/.test(new URL(url).hostname) && isLexicalElement(element)
      const chatSite = telegram || reddit || getChatContextSelector(url) !== null

      const direction = {
        fromLang: inputTranslationConfig.fromLang,
        toLang: inputTranslationConfig.toLang,
      }
      publish({
        kind: "initial",
        element,
        sessionKey,
        originalText,
        direction,
        feedback: { kind: "pending" },
      })
      const request = beginRequest(element, () => publish(null))
      try {
        const provider = resolveProviderRefForCapability(
          "inputTranslation",
          providersConfig,
          inputTranslationConfig.providerId,
        )
        if (!provider && isBuiltInAiProviderId(inputTranslationConfig.providerId))
          throw new UpstreamCloudDisabledError()
        const config = await readFeatureConfig()
        request.revision = config.revision
        if (!request.valid()) return
        const snapshot = resolveFeatureConfig("input", config.mainConfig, config.forkConfig)
        const langs = await resolveInputTranslationLang(originalText, config.mainConfig)
        if (!request.valid()) return
        if (langs.from.code === langs.to.code) {
          publish({ kind: "sameLanguage", element, lang: langs.to.code, sessionKey })
          return
        }
        const translatedText = await trackFeatureAttempt(
          {
            ...createFeatureUsageContext(
              ANALYTICS_FEATURE.INPUT_TRANSLATION,
              ANALYTICS_SURFACE.INPUT_TRANSLATION,
            ),
            // Capability-resolved so Built-in AI is not reported as "unknown":
            // it is synthesized by the registry and never a providersConfig row.
            ...classifyResolvedProvider(provider),
            char_count: text.length,
            target_language: langs.to.code,
          },
          () =>
            executeInputTranslation({
              text: originalText.trim(),
              source: langs.from.code,
              snapshot,
              readContext: ownership?.readContext,
            }),
        )

        if (!translatedText) {
          if (request.valid()) publish(null)
          return
        }
        request.settle(() => {
          if (sessionKey) {
            const draft = getEditableText(element)
            const writeId = ++writeIdRef.current
            writingElementRef.current = element
            void replaceTelegramDraft(element, translatedText, sessionKey).then((success) => {
              if (writeId !== writeIdRef.current) return
              writingElementRef.current = null
              if (getTelegramSessionKey(window.location.href, element) !== sessionKey) {
                publish(null)
                return
              }
              if (!success) {
                publish(
                  getEditableText(element) === draft
                    ? {
                        kind: "initial",
                        element,
                        sessionKey,
                        originalText,
                        direction,
                        feedback: {
                          kind: "error",
                          ...classifyInputTranslationError(new Error("Draft replacement failed")),
                        },
                      }
                    : getEditableText(element).trim()
                      ? { kind: "hint", element, sessionKey }
                      : null,
                )
                return
              }
              publish({
                kind: "translated",
                element,
                sessionKey,
                translatedText,
                originalText,
                fromCode: langs.from.code,
                lang: langs.to.code,
                langSource: "configured",
              })
            })
            return
          }
          setTextWithUndo(element, translatedText)
          publish({
            kind: "translated",
            element,
            sessionKey,
            originalText,
            fromCode: langs.from.code,
            lang: langs.to.code,
            langSource: "configured",
          })
        })
      } catch (error) {
        if (!request.valid()) return
        if (
          chatSite ||
          !(
            error instanceof HostedAiProviderUnavailableError ||
            error instanceof UpstreamCloudDisabledError
          )
        ) {
          publish({
            kind: "initial",
            element,
            sessionKey,
            originalText,
            direction,
            feedback: { kind: "error", ...classifyInputTranslationError(error) },
          })
        } else if (
          error instanceof HostedAiProviderUnavailableError ||
          error instanceof UpstreamCloudDisabledError
        ) {
          toastManager.add({
            type: "error",
            title: error.message,
            id: HOSTED_UNAVAILABLE_TOAST_ID,
          })
        }
      } finally {
        if (!request.valid()) request.cancel()
        if (!request.deferred) request.finish()
      }
    },
    [
      inputTranslationConfig.fromLang,
      inputTranslationConfig.toLang,
      inputTranslationConfig.providerId,
      providersConfig,
      beginRequest,
      publish,
    ],
  )

  const dismiss = useCallback(() => {
    languageMenuOpenRef.current = false
    requestRef.current?.finish()
    writeIdRef.current++
    writingElementRef.current = null
    publish(null)
  }, [publish])

  const setInteractionElement = useCallback((element: HTMLElement | null) => {
    interactionElementRef.current = element
  }, [])

  const focusEditorForInlineAction = useCallback((element: HTMLElement) => {
    const expectedBar = stateRef.current?.bar
    if (
      !expectedBar ||
      expectedBar.element !== element ||
      requestRef.current ||
      !element.isConnected
    )
      return false
    if (expectedBar.ownership && !expectedBar.ownership.isCurrent()) return false
    if (
      expectedBar.sessionKey &&
      getTelegramSessionKey(window.location.href, element) !== expectedBar.sessionKey
    )
      return false
    if (!hasFocusWithin(element, interactionElementRef.current)) return false
    const expectedUrl = element.ownerDocument.location.href
    const expectedDraft = getEditableText(element)
    element.focus({ preventScroll: true })
    // focus() synchronously runs host and hook listeners, which may end or replace the session.
    if (stateRef.current?.bar !== expectedBar || requestRef.current || !element.isConnected)
      return false
    if (
      element.ownerDocument.location.href !== expectedUrl ||
      getEditableText(element) !== expectedDraft
    )
      return false
    const activeElement = getDeepActiveElement()
    return activeElement === element || (activeElement !== null && element.contains(activeElement))
  }, [])

  const setLanguageMenuOpen = useCallback(
    (open: boolean) => {
      languageMenuOpenRef.current = open
      if (open) return

      // 菜单通过 Portal 挂在内联条 DOM 之外。菜单关闭后等焦点归位：若回到触发器或原输入框，
      // 继续保留；若是点到外部导致菜单关闭，翻译条只暂时隐藏，同语言提示则永久结束。
      window.setTimeout(() => {
        updateState((current) => {
          if (
            !current ||
            current.bar.element !== bar?.element ||
            hasFocusWithin(current.bar.element, interactionElementRef.current)
          ) {
            return current
          }
          return current.bar.kind !== "translated" ? null : { ...current, isVisible: false }
        })
      }, 0)
    },
    [bar, updateState],
  )

  const undo = useCallback(() => {
    const current = stateRef.current?.bar
    const wasWriting = writingElementRef.current === current?.element
    dismiss()
    // 元素可能已经被 SPA 卸载；此时什么都不写，别去动一个不存在的目标。
    if (
      current?.kind === "translated" &&
      (!current.ownership || current.ownership.isCurrent()) &&
      current.element.isConnected &&
      (!current.sessionKey ||
        (getTelegramSessionKey(window.location.href, current.element) === current.sessionKey &&
          (getEditableText(current.element) === current.translatedText || wasWriting)))
    ) {
      if (current.sessionKey) {
        current.element.setAttribute(TELEGRAM_DRAFT_VERSION_ATTR, `${Date.now()}-${Math.random()}`)
        const writeId = ++writeIdRef.current
        writingElementRef.current = current.element
        void replaceTelegramDraft(current.element, current.originalText, current.sessionKey).then(
          () => {
            if (writeId === writeIdRef.current) writingElementRef.current = null
          },
        )
      } else setTextWithUndo(current.element, current.originalText)
    }
  }, [dismiss])

  const retranslate = useCallback(
    async (code: LangCodeISO6393) => {
      const current = stateRef.current?.bar
      if (
        requestRef.current ||
        current?.kind !== "translated" ||
        !current.element.isConnected ||
        writingElementRef.current === current.element
      )
        return
      if (!focusEditorForInlineAction(current.element)) return
      const previous = { ...current, feedback: undefined, pendingLang: undefined }
      publish({ ...previous, pendingLang: code, feedback: { kind: "pending" } })
      const request = beginRequest(current.element, () => publish(previous))
      try {
        const provider = resolveProviderRefForCapability(
          "inputTranslation",
          providersConfig,
          inputTranslationConfig.providerId,
        )
        if (!provider && isBuiltInAiProviderId(inputTranslationConfig.providerId))
          throw new UpstreamCloudDisabledError()
        const config = await readFeatureConfig()
        request.revision = config.revision
        if (!request.valid()) return
        const snapshot = resolveFeatureConfig("input", config.mainConfig, config.forkConfig)
        const translated = await executeInputTranslation({
          text: current.originalText.trim(),
          source: current.fromCode,
          target: code,
          snapshot,
          readContext: current.ownership?.readContext,
        })
        if (!translated) {
          if (request.valid()) publish(previous)
          return
        }
        request.settle(() => {
          if (current.sessionKey) {
            const writeId = ++writeIdRef.current
            writingElementRef.current = current.element
            void replaceTelegramDraft(current.element, translated, current.sessionKey).then(
              (success) => {
                if (writeId !== writeIdRef.current) return
                writingElementRef.current = null
                if (
                  getTelegramSessionKey(window.location.href, current.element) !==
                  current.sessionKey
                ) {
                  publish(null)
                } else if (success)
                  publish({
                    ...previous,
                    translatedText: translated,
                    lang: code,
                    langSource: "manual",
                  })
                else if (getEditableText(current.element) === current.translatedText)
                  publish({
                    ...previous,
                    feedback: {
                      kind: "error",
                      ...classifyInputTranslationError(new Error("Draft replacement failed")),
                    },
                  })
                else
                  publish(
                    getEditableText(current.element).trim()
                      ? { kind: "hint", element: current.element, sessionKey: current.sessionKey }
                      : null,
                  )
              },
            )
            return
          }
          setTextWithUndo(current.element, translated)
          publish({ ...previous, lang: code, langSource: "manual" })
        })
      } catch (error) {
        if (request.valid())
          publish({
            ...previous,
            feedback: { kind: "error", ...classifyInputTranslationError(error) },
          })
      } finally {
        if (!request.valid()) request.cancel()
        if (!request.deferred) request.finish()
      }
    },
    [
      beginRequest,
      focusEditorForInlineAction,
      publish,
      providersConfig,
      inputTranslationConfig.providerId,
    ],
  )

  const retry = useCallback(async () => {
    const current = stateRef.current?.bar
    if (
      requestRef.current ||
      !current ||
      current.kind === "sameLanguage" ||
      current.kind === "hint" ||
      current.feedback?.kind !== "error" ||
      !current.feedback.retryable
    )
      return
    if (current.kind === "initial") {
      if (!focusEditorForInlineAction(current.element)) return
      await handleTranslation(current.element, current)
    } else await retranslate(current.lang)
  }, [focusEditorForInlineAction, handleTranslation, retranslate])

  useEffect(() => {
    if (!bar) return undefined

    let pendingSendText: string | null = null
    let sendConfirmationTimer: number | undefined
    let focusCheckTimer: number | undefined

    const dismissCurrentBar = () => {
      if (stateRef.current?.bar.element === bar.element) dismiss()
    }

    const hideCurrentBar = () => {
      if (
        bar.kind === "sameLanguage" ||
        (bar.kind === "initial" && bar.feedback.kind !== "pending")
      ) {
        dismissCurrentBar()
        return
      }
      updateState((current) => {
        if (current?.bar.element !== bar.element) return current
        // 同语言提示是一次性反馈，没有需要保留的原文快照。
        return { ...current, isVisible: false }
      })
    }

    const confirmPendingSend = () => {
      if (pendingSendText && getEditableText(bar.element).trim() === "") {
        pendingSendText = null
        dismissCurrentBar()
      }
    }

    const scheduleFocusCheck = () => {
      window.clearTimeout(focusCheckTimer)
      focusCheckTimer = window.setTimeout(() => {
        if (
          !languageMenuOpenRef.current &&
          !hasFocusWithin(bar.element, interactionElementRef.current)
        ) {
          hideCurrentBar()
        }
      }, 0)
    }

    const handleFocusOut = (event: FocusEvent) => {
      if (
        eventComesFrom(event, bar.element) ||
        eventComesFrom(event, interactionElementRef.current)
      ) {
        scheduleFocusCheck()
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (bar.kind === "sameLanguage" || !eventComesFrom(event, bar.element)) return

      if (bar.ownership && !bar.ownership.isCurrent()) {
        dismissCurrentBar()
        return
      }
      if (
        bar.sessionKey &&
        getTelegramSessionKey(window.location.href, bar.element) !== bar.sessionKey
      ) {
        dismissCurrentBar()
        return
      }

      // 输入框已被宿主清空时通常表示发送完成；即使漏掉了发送事件，也不能恢复旧会话。
      if (!document.contains(bar.element) || getEditableText(bar.element).trim() === "") {
        dismissCurrentBar()
        return
      }

      updateState((current) =>
        current?.bar.element === bar.element ? { ...current, isVisible: true } : current,
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const withinInteraction =
        eventComesFrom(event, bar.element) ||
        eventComesFrom(event, interactionElementRef.current) ||
        languageMenuOpenRef.current

      if (event.key === "Escape" && withinInteraction) {
        // Base UI 先消费菜单展开时的 Escape；菜单关闭回调会在焦点落到外部时补做失焦检查。
        if (!languageMenuOpenRef.current) dismissCurrentBar()
        return
      }

      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        event.isComposing ||
        !eventComesFrom(event, bar.element)
      ) {
        return
      }

      const currentText = getEditableText(bar.element).trim()
      if (!currentText) return

      // Enter 只表示“可能发送”。只有宿主随后真的清空输入框，才确认消息已提交。
      pendingSendText = currentText
      window.clearTimeout(sendConfirmationTimer)
      sendConfirmationTimer = window.setTimeout(() => {
        pendingSendText = null
      }, SEND_CONFIRMATION_WINDOW_MS)
      queueMicrotask(confirmPendingSend)
    }

    const handleInput = (event: Event) => {
      if (!eventComesFrom(event, bar.element)) return
      if (writingElementRef.current === bar.element) return
      if (bar.kind === "hint") return
      if (bar.sessionKey && getEditableText(bar.element).trim() && !pendingSendText) {
        publish({ kind: "hint", element: bar.element, sessionKey: bar.sessionKey })
        return
      }
      // 同语言提示没有可撤销对象，只是本次三空格操作的一次性反馈；用户继续输入即收起。
      if (bar.kind !== "translated") {
        dismissCurrentBar()
        return
      }
      if (!pendingSendText) {
        if (bar.sessionKey) dismissCurrentBar()
        return
      }
      if (getEditableText(bar.element).trim() === "") {
        pendingSendText = null
        dismissCurrentBar()
      } else {
        // Enter 后仍有内容，说明这是换行或宿主没有提交消息。
        pendingSendText = null
      }
    }

    const handleSubmit = (event: SubmitEvent) => {
      if (event.target instanceof HTMLFormElement && event.target.contains(bar.element)) {
        dismissCurrentBar()
      }
    }

    document.addEventListener("focusout", handleFocusOut, true)
    document.addEventListener("focusin", handleFocusIn, true)
    document.addEventListener("keydown", handleKeyDown, true)
    document.addEventListener("submit", handleSubmit, true)
    bar.element.addEventListener("input", handleInput)

    const contentObserver = new MutationObserver(confirmPendingSend)
    contentObserver.observe(bar.element, { childList: true, characterData: true, subtree: true })

    const sessionRoot =
      bar.ownership?.root ?? (bar.sessionKey ? bar.element.closest(".MiddleColumn, .chat") : null)
    const sessionObserver = sessionRoot
      ? new MutationObserver(() => {
          if (
            (bar.ownership && !bar.ownership.isCurrent()) ||
            (bar.sessionKey &&
              getTelegramSessionKey(window.location.href, bar.element) !== bar.sessionKey)
          )
            dismissCurrentBar()
        })
      : null
    sessionObserver?.observe(sessionRoot!, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-list-key", "data-peer-id", "data-id", "thingid", "title"],
    })

    return () => {
      window.clearTimeout(sendConfirmationTimer)
      window.clearTimeout(focusCheckTimer)
      document.removeEventListener("focusout", handleFocusOut, true)
      document.removeEventListener("focusin", handleFocusIn, true)
      document.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("submit", handleSubmit, true)
      bar.element.removeEventListener("input", handleInput)
      contentObserver.disconnect()
      sessionObserver?.disconnect()
    }
  }, [bar, dismiss, publish, updateState])

  useEffect(() => {
    if (!inputTranslationConfig.enabled) return undefined

    const showTelegramHint = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const url = window.location.href
      const telegram = isTelegramUrl(url)
      const element = telegram
        ? target
        : getChatContextSelector(url)
          ? target.closest<HTMLElement>('[contenteditable="true"][role="textbox"]')
          : null
      if (!element) return
      const sessionKey = telegram ? (getTelegramSessionKey(url, element) ?? undefined) : undefined
      if (telegram && !sessionKey) return
      if (telegram && event.type === "input") {
        element.setAttribute(TELEGRAM_DRAFT_VERSION_ATTR, `${Date.now()}-${Math.random()}`)
      }
      if (writingElementRef.current === element) return
      if (!getEditableText(element).trim()) {
        if (stateRef.current?.bar.element === element) publish(null)
        return
      }
      const current = stateRef.current?.bar
      if (!current || current.element !== element) {
        if (!requestRef.current) publish({ kind: "hint", element, sessionKey })
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only process space key
      if (
        event.key !== SPACE_KEY ||
        event.isComposing ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        // Reset on any other key
        spaceTimestampsRef.current = []
        triggerSnapshotRef.current = null
        return
      }

      // Check if the active element is an input field
      const activeElement = getDeepActiveElement()
      const isInputField =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)

      if (!isInputField || !activeElement) {
        spaceTimestampsRef.current = []
        triggerSnapshotRef.current = null
        return
      }
      if (
        isTelegramUrl(window.location.href) &&
        !getTelegramSessionKey(window.location.href, activeElement)
      )
        return

      const now = Date.now()
      const timestamps = spaceTimestampsRef.current

      // Remove timestamps older than threshold
      const timeThreshold = inputTranslationConfig.timeThreshold
      if (timestamps.length && now - timestamps[timestamps.length - 1]! > timeThreshold) {
        timestamps.length = 0
      }
      while (timestamps.length > 0 && now - timestamps[0]! > timeThreshold * (triggerCount - 1)) {
        timestamps.shift()
      }

      if (!timestamps.length || triggerSnapshotRef.current?.element !== activeElement) {
        timestamps.length = 0
        triggerSnapshotRef.current = {
          element: activeElement,
          text: getEditableText(activeElement),
        }
      }

      // Add current timestamp
      timestamps.push(now)

      // Check if we have enough rapid presses
      if (timestamps.length >= triggerCount) {
        // Check if all presses are within the time threshold
        const allWithinThreshold = timestamps.every((ts, i) => {
          if (i === 0) return true
          return ts - timestamps[i - 1]! <= timeThreshold
        })

        if (allWithinThreshold) {
          event.preventDefault()
          spaceTimestampsRef.current = []
          void handleTranslation(activeElement)
        }
      }
    }

    const handleDraftEdit = (event: Event) => {
      if (!eventComesFrom(event, triggerSnapshotRef.current?.element ?? null)) return
      // A keyboard space's default insertion is part of the sequence. Paste, drop,
      // composition and other edits are not: the next space must take a fresh snapshot.
      if (
        event instanceof InputEvent &&
        event.inputType === "insertText" &&
        event.data === SPACE_KEY &&
        !event.isComposing
      )
        return
      spaceTimestampsRef.current = []
      triggerSnapshotRef.current = null
    }
    document.addEventListener("input", handleDraftEdit, true)
    document.addEventListener("input", showTelegramHint, true)
    document.addEventListener("focusin", showTelegramHint, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("input", handleDraftEdit, true)
      document.removeEventListener("input", showTelegramHint, true)
      document.removeEventListener("focusin", showTelegramHint, true)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [
    inputTranslationConfig.enabled,
    inputTranslationConfig.timeThreshold,
    triggerCount,
    handleTranslation,
    publish,
  ])

  return {
    bar: barState?.isVisible ? bar : null,
    undo,
    retranslate,
    retry,
    dismiss,
    setInteractionElement,
    setLanguageMenuOpen,
  }
}
