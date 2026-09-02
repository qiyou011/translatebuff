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
import { i18n } from "@/utils/i18n"
import { getLanguageName } from "@/utils/language-labels"
import { HostedAiProviderUnavailableError } from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { resolveInputTranslationLang } from "./resolve-lang"

const SPACE_KEY = " "
const TRIGGER_COUNT = 3
const LAST_CYCLE_SWAPPED_KEY = "read-frog-input-translation-last-cycle-swapped"
const SPINNER_ID = "read-frog-input-translation-spinner"
/** Hammering the hotkey must stack one toast, not one per attempt. */
const HOSTED_UNAVAILABLE_TOAST_ID = "input-translation-hosted-unavailable"
/** 同语言提示同样只叠一条，理由与上面那条一致。 */
const SAME_LANGUAGE_TOAST_ID = "input-translation-same-language"

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

/**
 * 一次已完成替换的输入翻译。内联条要靠它显示语言、重译和撤销。
 *
 * 必须记住 `element` 而不只是文本：同一个页面上主输入框、消息编辑框、搜索框同时存在，
 * 只记文本会把 A 框的原文撤销进 B 框。
 */
export interface InputTranslationBar {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement
  originalText: string
  /** 翻译方向的来源端，改语言重译时照旧用它。 */
  fromCode: LangCodeISO6393
  lang: LangCodeISO6393
  langSource: InputTranslationLangSource
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
  // 只在替换真的发生之后写一次。竞态保护仍旧用下面那个闭包局部变量——setState 是异步的，
  // 同一个 async 闭包读不到新值，拿它当守卫会漏。
  const [bar, setBar] = useState<InputTranslationBar | null>(null)

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
        toastManager.add({
          type: "warning",
          title: i18n.t("translation.autoModeSameLanguage", [getLanguageName(langs.to.code)]),
          id: SAME_LANGUAGE_TOAST_ID,
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
          setBar({
            element,
            originalText,
            fromCode: langs.from.code,
            lang: langs.to.code,
            langSource: langs.to.source,
          })
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

  const dismiss = useCallback(() => setBar(null), [])

  const undo = useCallback(() => {
    // 元素可能已经被 SPA 卸载；此时什么都不写，别去动一个不存在的目标。
    if (bar && document.contains(bar.element)) {
      setTextWithUndo(bar.element, bar.originalText)
    }
    setBar(null)
  }, [bar])

  const retranslate = useCallback(
    async (code: LangCodeISO6393) => {
      if (!bar || !document.contains(bar.element)) return
      // 拿原文重译，不是拿上一轮的译文再翻一遍——那样会一路失真。
      const translated = await translateTextForInput(bar.originalText, bar.fromCode, code)
      if (!translated) return
      setTextWithUndo(bar.element, translated)
      setBar({ ...bar, lang: code, langSource: "explicit" })
    },
    [bar],
  )

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

  return { bar, undo, retranslate, dismiss }
}
