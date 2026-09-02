import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { InputTranslationBar as BarState } from "./use-input-translation"
import { useCallback, useEffect, useState } from "react"
import { LanguageCombobox } from "@/components/language-combobox"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"

interface InputTranslationBarProps {
  bar: BarState | null
  onRetranslate: (code: LangCodeISO6393) => void
  onUndo: () => void
  onDismiss: () => void
}

interface BarPosition {
  top: number
  left: number
}

/**
 * 挂在输入框上方的纠正条。
 *
 * 自动检测判错时这是用户唯一的挽回手段，所以它不是装饰：显示这次翻成了哪种语言、
 * 这个语言是怎么来的（检测出来的还是回退到网页源语言），并给出改语言与撤销两个出口。
 */
export function InputTranslationBar({
  bar,
  onRetranslate,
  onUndo,
  onDismiss,
}: InputTranslationBarProps) {
  const [position, setPosition] = useState<BarPosition | null>(null)

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
      // 点条子会先让输入框失焦，click 落地前条子就没了；按下时就阻掉默认行为，焦点留在输入框。
      onMouseDown={(event) => event.preventDefault()}
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateY(-100%)",
        zIndex: 2147483000,
      }}
      className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs shadow-md"
    >
      <span className="text-muted-foreground">{i18n.t("inputTranslationBar.translateTo")}</span>
      <LanguageCombobox value={bar.lang} onValueChange={handleLanguageChange} triggerSize="sm" />
      <span className="text-muted-foreground">
        {bar.langSource === "chatContext"
          ? i18n.t("inputTranslationBar.autoDetected")
          : bar.langSource === "pageSource"
            ? i18n.t("inputTranslationBar.fromPageSource")
            : null}
      </span>
      <Button variant="ghost" size="sm" onClick={onUndo}>
        {i18n.t("inputTranslationBar.undo")}
      </Button>
    </div>
  )
}
