import type { LangCodeISO6393 } from "@read-frog/definitions"
import type {
  InputTranslationBar as BarState,
  InputTranslationBarSource,
} from "./use-input-translation"
import { Info } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTheme } from "@/components/providers/theme-provider"
import { i18n } from "@/utils/i18n"
import localStyles from "./input-translation-bar.css?inline"
import { InputTranslationLanguageSelect } from "./input-translation-language-select"
import { INPUT_TRANSLATION_PALETTES } from "./input-translation-palette"
import { useInputTranslationTheme } from "./use-input-translation-theme"

interface InputTranslationBarProps {
  bar: BarState | null
  onRetranslate: (code: LangCodeISO6393) => void
  onUndo: () => void
  onDismiss: () => void
  onInteractionElementChange: (element: HTMLElement | null) => void
  onLanguageMenuOpenChange: (open: boolean) => void
}

interface BarPosition {
  top: number
  left: number
}

const SOURCE_LABEL_KEYS = {
  chatContext: "inputTranslationBar.autoDetected",
  pageSource: "inputTranslationBar.fromPageSource",
  manual: "inputTranslationBar.manualSelection",
} as const satisfies Record<InputTranslationBarSource, string>

/**
 * 两种形态共用的外壳。
 *
 * 刻意不是浮层卡片——无描边、无阴影，只是贴着输入框的一小块，宽度随内容收拢，衬一层
 * 不透明中性底与聊天区分开，颜色由输入区域主题决定，避免背景图片影响可读性。
 */
const SHELL_CLASS =
  "rf-input-translation-shell flex h-7 w-fit max-w-[calc(100vw-16px)] items-center gap-2.5 rounded-md px-2.5 text-xs"

/** 语言选择器与撤销都是纯文字，不是按钮——同上，别把它做成一块控件。 */
const PLAIN_TRIGGER_CLASS = "rf-input-translation-trigger h-auto px-0 py-0 font-semibold"

/**
 * 挂在输入框上方的纠正条。
 *
 * 自动判定判错时这是用户唯一的挽回手段，所以它不是装饰：显示这次翻成了哪种语言、
 * 这个语言是怎么来的，并给出改语言与撤销两个出口。
 *
 * 两端同语言那次什么都没换，于是换成一条没有撤销按钮的提示——同一位置、同款外观，
 * 但不给一个无从撤销的按钮。它是那次操作唯一的反馈，所以文字用正文亮度而不是次级色。
 */
export function InputTranslationBar({
  bar,
  onRetranslate,
  onUndo,
  onDismiss,
  onInteractionElementChange,
  onLanguageMenuOpenChange,
}: InputTranslationBarProps) {
  const [position, setPosition] = useState<BarPosition | null>(null)
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
  const { theme: extensionTheme } = useTheme()
  const { theme, refresh } = useInputTranslationTheme(bar?.element ?? null, extensionTheme)
  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      if (open) refresh()
      onLanguageMenuOpenChange(open)
    },
    [refresh, onLanguageMenuOpenChange],
  )

  useEffect(() => {
    const root = portalContainer?.getRootNode()
    if (!portalContainer || !(root instanceof ShadowRoot)) return undefined

    // React/Base UI handle the menu inside the shadow tree first. Only then stop
    // its keyboard/paste events from reaching host shortcuts (Discord focuses its
    // composer on bubbling keydown and paste). A listener on the portal container itself
    // would run before React's delegated handlers and break menu navigation.
    const isolateMenuKeyboard = (event: Event) => {
      if (
        event
          .composedPath()
          .some((target) => target instanceof Node && portalContainer.contains(target))
      ) {
        event.stopPropagation()
      }
    }
    const eventTypes = ["keydown", "keypress", "keyup", "paste"] as const
    for (const type of eventTypes) root.addEventListener(type, isolateMenuKeyboard)
    return () => {
      for (const type of eventTypes) root.removeEventListener(type, isolateMenuKeyboard)
    }
  }, [portalContainer])

  useEffect(() => {
    if (!bar) {
      setPosition(null)
      return undefined
    }

    const element = bar.element
    const update = () => {
      // SPA 换了路由、输入框被卸载——此时条子没有可依附的目标，直接收掉。
      if (!element.isConnected) {
        onDismiss()
        return
      }
      const rect = element.getBoundingClientRect()
      setPosition({ top: rect.top, left: rect.left })
    }

    update()
    // 用视口坐标 + fixed 定位：容器是否处在文档原点无关紧要，滚动时重算即可。
    // capture 是必须的——Discord 的消息列表自己滚动，事件不冒泡到 window。
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    // 输入框多行会长高，位置得跟着变。
    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
      observer.disconnect()
    }
  }, [bar, onDismiss])

  const handleLanguageChange = useCallback(
    (value: LangCodeISO6393 | "auto") => {
      if (value !== "auto") {
        onRetranslate(value)
      }
    },
    [onRetranslate],
  )

  if (!bar || !position) {
    return null
  }

  return (
    <div
      ref={onInteractionElementChange}
      data-input-translation-theme={theme}
      className="rf-input-translation-scope"
      style={INPUT_TRANSLATION_PALETTES[theme]}
    >
      <style>{localStyles}</style>
      {/* Untransformed sibling of the bar: the portal shares both theme and interaction
          boundary without changing fixed positioning or clipping the upward menu. */}
      <div ref={setPortalContainer} />
      <div
        // 点条子会先让输入框失焦，click 落地前条子就没了；按下时就阻掉默认行为，焦点留在输入框。
        onMouseDown={(event) => {
          // Portal events also bubble through this React ancestor, but search needs
          // native focus and text selection. Guard only the physical bar surface.
          if (event.currentTarget.contains(event.target as Node)) event.preventDefault()
        }}
        style={{
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: "translateY(-100%)",
          zIndex: 2147483000,
        }}
        className={SHELL_CLASS}
      >
        {bar.kind === "sameLanguage" ? (
          <span className="flex items-center gap-1.5 text-foreground">
            <Info className="size-3.5 shrink-0" />
            {i18n.t("inputTranslationBar.sameLanguage")}
          </span>
        ) : (
          <>
            <span className="shrink-0 text-muted-foreground">
              {i18n.t("inputTranslationBar.translateTo")}
            </span>
            {portalContainer && (
              <InputTranslationLanguageSelect
                value={bar.lang}
                onValueChange={handleLanguageChange}
                triggerClassName={PLAIN_TRIGGER_CLASS}
                container={portalContainer}
                onOpenChange={handleMenuOpenChange}
              />
            )}
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {i18n.t(SOURCE_LABEL_KEYS[bar.langSource])}
            </span>
            <button
              type="button"
              onClick={onUndo}
              className="rf-input-translation-undo shrink-0 cursor-pointer hover:underline"
            >
              {i18n.t("inputTranslationBar.undo")}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
