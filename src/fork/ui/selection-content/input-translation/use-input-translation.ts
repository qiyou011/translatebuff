import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { InputTranslationLangSource } from "./resolve-lang"
import type { InputTranslationLang } from "@/types/config/config"
import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureAttempt } from "@/utils/analytics"
import { classifyResolvedProvider } from "@/utils/analytics-provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getLocalConfig } from "@/utils/config/storage"
import { INPUT_REPLACE_REQUEST_TYPE } from "@/utils/constants/input-injector"
import { translateTextForInput } from "@/utils/host/translate/translate-variants"
import { HostedAiProviderUnavailableError } from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { resolveInputTranslationLang } from "./resolve-lang"

const SPACE_KEY = " "
const TRIGGER_COUNT = 3
const LAST_CYCLE_SWAPPED_KEY = "read-frog-input-translation-last-cycle-swapped"
const SPINNER_ID = "read-frog-input-translation-spinner"
const SEND_CONFIRMATION_WINDOW_MS = 1000
/** Hammering the hotkey must stack one toast, not one per attempt. */
const HOSTED_UNAVAILABLE_TOAST_ID = "input-translation-hosted-unavailable"

function getLastCycleSwapped(): boolean {
  try {
    return sessionStorage.getItem(LAST_CYCLE_SWAPPED_KEY) === "true"
  } catch {
    return false
  }
}

function setLastCycleSwapped(swapped: boolean): void {
  try {
    sessionStorage.setItem(LAST_CYCLE_SWAPPED_KEY, String(swapped))
  } catch {
    // sessionStorage may not be available
  }
}

/**
 * Create and show a loading spinner near the input element
 * Uses the same style as page translation loading (border spinner with primary color)
 */
function showSpinner(element: HTMLElement): () => void {
  // Remove any existing spinner
  const existingSpinner = document.getElementById(SPINNER_ID)
  if (existingSpinner) {
    existingSpinner.remove()
  }

  // Create spinner element - same style as createLightweightSpinner in translate/ui/spinner.ts
  const spinner = document.createElement("span")
  spinner.id = SPINNER_ID

  // Use the same border spinner style as page translation
  // Colors: brand yellow (oklch(76.034% 0.12361 82.191)) and muted gray
  spinner.style.cssText = `
    --rf-brand: oklch(76.034% 0.12361 82.191);
    position: absolute !important;
    display: inline-block !important;
    width: 10px !important;
    height: 10px !important;
    border: 3px solid #e5e5e5 !important;
    border-top: 3px solid var(--rf-brand) !important;
    border-radius: 50% !important;
    box-sizing: content-box !important;
    z-index: 999999 !important;
    pointer-events: none !important;
  `

  // Respect user's motion preferences for accessibility
  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

  if (!prefersReducedMotion) {
    // Use Web Animations API for rotation
    spinner.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
      duration: 600,
      iterations: Infinity,
      easing: "linear",
    })
  } else {
    // For reduced motion, keep the spinner static but preserve the brand
    // segment so the loading state remains visible without animation.
    spinner.style.borderTopColor = "var(--rf-brand)"
  }

  // Calculate position - vertically centered relative to the element
  const rect = element.getBoundingClientRect()
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const spinnerSize = 16 // 10px + 3px border * 2

  // Vertically center for all element types
  const top = rect.top + scrollY + (rect.height - spinnerSize) / 2
  const left = rect.right + scrollX - spinnerSize - 8

  spinner.style.top = `${top}px`
  spinner.style.left = `${left}px`

  document.body.appendChild(spinner)

  // Return cleanup function
  return () => {
    spinner.remove()
  }
}

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
  return element.textContent ?? ""
}

function eventComesFrom(event: Event, element: HTMLElement | null): boolean {
  if (!element) return false
  return event.composedPath().some((target) => {
    return target === element || (target instanceof Node && element.contains(target))
  })
}

function hasFocusWithin(element: HTMLElement, interactionElement: HTMLElement | null): boolean {
  const activeElement = element.ownerDocument.activeElement
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
export type InputTranslationBarSource = "chatContext" | "pageSource" | "manual"

/**
 * 输入框上方那条的两种形态。
 *
 * 必须记住 `element` 而不只是文本：同一个页面上主输入框、消息编辑框、搜索框同时存在，
 * 只记文本会把 A 框的原文撤销进 B 框。
 */
export type InputTranslationBar =
  | {
      kind: "translated"
      element: HTMLInputElement | HTMLTextAreaElement | HTMLElement
      originalText: string
      /** 翻译方向的来源端，改语言重译时照旧用它。 */
      fromCode: LangCodeISO6393
      lang: LangCodeISO6393
      langSource: InputTranslationBarSource
    }
  /** 两端同语言、什么都没换。同一位置、同款外观，但没有可撤销的对象。 */
  | { kind: "sameLanguage"; element: HTMLElement; lang: LangCodeISO6393 }

type InputTranslationBarState = {
  bar: InputTranslationBar
  isVisible: boolean
}

/**
 * 语言由配置直接给定（钉死的源语言、固定语言码）时不挂条子：没有自动判定，
 * 也就没有要纠错的对象，挂出来只是噪音。
 */
function toBarSource(source: InputTranslationLangSource): InputTranslationBarSource | null {
  return source === "explicit" ? null : source
}

/**
 * 把两端的语言选项解析成具体语言码。配置走 `getLocalConfig()` 而不是 atom 切片拼装——
 * `getEffectiveSiteRule` 按 Config 对象身份做记忆，每次现拼会让那份记忆永不命中。
 */
async function resolveLangPair(fromLang: InputTranslationLang, toLang: InputTranslationLang) {
  const config = await getLocalConfig()
  if (!config) {
    return null
  }
  const url = window.location.href
  const [from, to] = await Promise.all([
    resolveInputTranslationLang(fromLang, config, url, document),
    resolveInputTranslationLang(toLang, config, url, document),
  ])
  return { from, to }
}

export function useInputTranslation() {
  const inputTranslationConfig = useAtomValue(configFieldsAtomMap.inputTranslation)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const spaceTimestampsRef = useRef<number[]>([])
  const isTranslatingRef = useRef(false)
  const interactionElementRef = useRef<HTMLElement | null>(null)
  const languageMenuOpenRef = useRef(false)
  // 只在替换真的发生之后写一次。竞态保护仍旧用下面那个闭包局部变量——setState 是异步的，
  // 同一个 async 闭包读不到新值，拿它当守卫会漏。
  const [barState, setBarState] = useState<InputTranslationBarState | null>(null)
  // `bar` 是仍然存活的翻译会话；`barState.isVisible` 只控制 UI。真正失焦时两者不能一起清空，
  // 否则重新聚焦原输入框时会丢失 originalText，也无法恢复撤销入口。
  const bar = barState?.bar ?? null

  const handleTranslation = useCallback(
    async (element: HTMLInputElement | HTMLTextAreaElement | HTMLElement) => {
      if (isTranslatingRef.current) return

      // Security: skip password fields to prevent exposing sensitive data
      if (element instanceof HTMLInputElement && element.type === "password") {
        return
      }

      // Get the text content based on element type
      let text: string
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        text = element.value
      } else if (element.isContentEditable) {
        text = element.textContent || ""
      } else {
        return
      }

      // Remove trailing whitespace added by space key presses
      text = text.trim()

      // For input/textarea, trim whitespace immediately (execCommand works reliably).
      // For contenteditable, skip — we'll do a single replacement after translation
      // returns, because rich text editors can't be updated reliably from isolated world.
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        setTextWithUndo(element, text)
      }

      if (!text) {
        return
      }

      // Determine fromLang and toLang, possibly swapped if cycle is enabled
      let fromLang = inputTranslationConfig.fromLang
      let toLang = inputTranslationConfig.toLang

      if (inputTranslationConfig.enableCycle) {
        const wasSwapped = getLastCycleSwapped()
        if (wasSwapped) {
          // Already swapped last time, use original direction
          setLastCycleSwapped(false)
        } else {
          // Swap direction
          ;[fromLang, toLang] = [toLang, fromLang]
          setLastCycleSwapped(true)
        }
      }

      isTranslatingRef.current = true

      // 语言解析放在这一层，而不是引擎里：方向互换刚在上面做完，引擎本来就收具体语言码，
      // 于是引擎一行不用改；解析顺带带出的 `source` 还要交给界面区分「自动检测」与
      // 「按网页源语言」。守卫在解析之前就置位，所以下面每条提前返回都要自己放开。
      const langs = await resolveLangPair(fromLang, toLang)
      if (!langs) {
        isTranslatingRef.current = false
        return
      }

      // 两端同语言时提前收手。引擎内部也会返回空串，但那个空串和「没什么可翻」的空串
      // 无法区分，调用方据此弹不了提示——用户连按三下空格却毫无反应，只会以为功能坏了。
      // 在这里断掉还顺带省下 spinner 与 provider 解析。
      if (langs.from.code === langs.to.code) {
        setBarState({
          bar: { kind: "sameLanguage", element, lang: langs.to.code },
          isVisible: true,
        })
        isTranslatingRef.current = false
        return
      }

      // Show spinner near the input element
      const hideSpinner = showSpinner(element)

      // Store original text to detect if user edited during translation
      const originalText = text

      try {
        const translatedText = await trackFeatureAttempt(
          {
            ...createFeatureUsageContext(
              ANALYTICS_FEATURE.INPUT_TRANSLATION,
              ANALYTICS_SURFACE.INPUT_TRANSLATION,
            ),
            // Capability-resolved so Built-in AI is not reported as "unknown":
            // it is synthesized by the registry and never a providersConfig row.
            ...classifyResolvedProvider(
              resolveProviderRefForCapability(
                "inputTranslation",
                providersConfig,
                inputTranslationConfig.providerId,
              ),
            ),
          },
          () => translateTextForInput(text, langs.from.code, langs.to.code),
        )

        // Check if element content changed during translation (user input)
        let currentText: string
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          currentText = element.value
        } else if (element.isContentEditable) {
          currentText = element.textContent || ""
        } else {
          currentText = originalText
        }

        // Only apply translation if content hasn't changed during async operation
        if (currentText.trim() === originalText && translatedText) {
          setTextWithUndo(element, translatedText)
          // 放弃替换的那条分支刻意不挂内联条：否则撤销会把用户新输入的内容
          // 改写成一段他没要的旧文本。
          const barSource = toBarSource(langs.to.source)
          if (barSource) {
            setBarState({
              bar: {
                kind: "translated",
                element,
                originalText,
                fromCode: langs.from.code,
                lang: langs.to.code,
                langSource: barSource,
              },
              isVisible: true,
            })
          }
        }
      } catch (error) {
        // A hosted plan/quota denial is a state the user can act on, not a
        // defect: without this the spinner just appears and disappears and
        // the feature reads as broken.
        if (error instanceof HostedAiProviderUnavailableError) {
          toastManager.add({
            type: "error",
            title: error.message,
            id: HOSTED_UNAVAILABLE_TOAST_ID,
          })
        }
        console.error("Input translation error:", error)
      } finally {
        hideSpinner()
        isTranslatingRef.current = false
      }
    },
    [
      inputTranslationConfig.fromLang,
      inputTranslationConfig.toLang,
      inputTranslationConfig.enableCycle,
      inputTranslationConfig.providerId,
      providersConfig,
    ],
  )

  const dismiss = useCallback(() => {
    languageMenuOpenRef.current = false
    setBarState(null)
  }, [])

  const setInteractionElement = useCallback((element: HTMLElement | null) => {
    interactionElementRef.current = element
  }, [])

  const setLanguageMenuOpen = useCallback(
    (open: boolean) => {
      languageMenuOpenRef.current = open
      if (open) return

      // 菜单通过 Portal 挂在内联条 DOM 之外。菜单关闭后等焦点归位：若回到触发器或原输入框，
      // 继续保留；若是点到外部导致菜单关闭，翻译条只暂时隐藏，同语言提示则永久结束。
      window.setTimeout(() => {
        setBarState((current) => {
          if (
            !current ||
            current.bar !== bar ||
            hasFocusWithin(current.bar.element, interactionElementRef.current)
          ) {
            return current
          }
          return current.bar.kind === "sameLanguage" ? null : { ...current, isVisible: false }
        })
      }, 0)
    },
    [bar],
  )

  const undo = useCallback(() => {
    // 元素可能已经被 SPA 卸载；此时什么都不写，别去动一个不存在的目标。
    if (bar?.kind === "translated" && document.contains(bar.element)) {
      setTextWithUndo(bar.element, bar.originalText)
    }
    setBarState(null)
  }, [bar])

  const retranslate = useCallback(
    async (code: LangCodeISO6393) => {
      if (bar?.kind !== "translated" || !document.contains(bar.element)) return
      // 拿原文重译，不是拿上一轮的译文再翻一遍——那样会一路失真。
      const translated = await translateTextForInput(bar.originalText, bar.fromCode, code)
      if (!translated) return
      setTextWithUndo(bar.element, translated)
      // 原型要求标注由「自动检测」改成「手动选择」。
      setBarState((current) =>
        current?.bar === bar
          ? { ...current, bar: { ...bar, lang: code, langSource: "manual" } }
          : current,
      )
    },
    [bar],
  )

  useEffect(() => {
    if (!bar) return undefined

    let pendingSendText: string | null = null
    let sendConfirmationTimer: number | undefined
    let focusCheckTimer: number | undefined

    const dismissCurrentBar = () => {
      setBarState((current) => (current?.bar === bar ? null : current))
    }

    const hideCurrentBar = () => {
      setBarState((current) => {
        if (current?.bar !== bar) return current
        // 同语言提示是一次性反馈，没有需要保留的原文快照。
        return bar.kind === "sameLanguage" ? null : { ...current, isVisible: false }
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
      if (bar.kind !== "translated" || !eventComesFrom(event, bar.element)) return

      // 输入框已被宿主清空时通常表示发送完成；即使漏掉了发送事件，也不能恢复旧会话。
      if (!document.contains(bar.element) || getEditableText(bar.element).trim() === "") {
        dismissCurrentBar()
        return
      }

      setBarState((current) => (current?.bar === bar ? { ...current, isVisible: true } : current))
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
      // 同语言提示没有可撤销对象，只是本次三空格操作的一次性反馈；用户继续输入即收起。
      if (bar.kind === "sameLanguage") {
        dismissCurrentBar()
        return
      }
      if (!pendingSendText) return
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

    return () => {
      window.clearTimeout(sendConfirmationTimer)
      window.clearTimeout(focusCheckTimer)
      document.removeEventListener("focusout", handleFocusOut, true)
      document.removeEventListener("focusin", handleFocusIn, true)
      document.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("submit", handleSubmit, true)
      bar.element.removeEventListener("input", handleInput)
      contentObserver.disconnect()
    }
  }, [bar])

  useEffect(() => {
    if (!inputTranslationConfig.enabled) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only process space key
      if (event.key !== SPACE_KEY) {
        // Reset on any other key
        spaceTimestampsRef.current = []
        return
      }

      // Check if the active element is an input field
      const activeElement = document.activeElement
      const isInputField =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)

      if (!isInputField || !activeElement) {
        spaceTimestampsRef.current = []
        return
      }

      const now = Date.now()
      const timestamps = spaceTimestampsRef.current

      // Remove timestamps older than threshold
      const timeThreshold = inputTranslationConfig.timeThreshold
      while (timestamps.length > 0 && now - timestamps[0]! > timeThreshold * (TRIGGER_COUNT - 1)) {
        timestamps.shift()
      }

      // Add current timestamp
      timestamps.push(now)

      // Check if we have enough rapid presses
      if (timestamps.length >= TRIGGER_COUNT) {
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

    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [inputTranslationConfig.enabled, inputTranslationConfig.timeThreshold, handleTranslation])

  return {
    bar: barState?.isVisible ? bar : null,
    undo,
    retranslate,
    dismiss,
    setInteractionElement,
    setLanguageMenuOpen,
  }
}
