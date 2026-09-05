import type { Theme } from "@/types/config/theme"
import { useCallback, useLayoutEffect, useState } from "react"
import { inputThemeAncestors, resolveInputTranslationTheme } from "./input-translation-theme"

export function useInputTranslationTheme(element: HTMLElement | null, fallback: Theme) {
  const [theme, setTheme] = useState(fallback)
  const refresh = useCallback(() => {
    setTheme(element?.isConnected ? resolveInputTranslationTheme(element, fallback) : fallback)
  }, [element, fallback])

  useLayoutEffect(() => {
    refresh()
    if (!element) return undefined
    let frame: number | undefined
    const schedule = () => {
      if (frame !== undefined) return
      frame = requestAnimationFrame(() => {
        frame = undefined
        refresh()
      })
    }
    const observer = new MutationObserver(schedule)
    for (const ancestor of inputThemeAncestors(element)) {
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme"],
      })
    }
    element.addEventListener("focus", refresh)
    return () => {
      observer.disconnect()
      element.removeEventListener("focus", refresh)
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [element, refresh])

  return { theme, refresh }
}
