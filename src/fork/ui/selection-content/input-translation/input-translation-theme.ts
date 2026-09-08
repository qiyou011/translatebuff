import type { Theme } from "@/types/config/theme"

/** Bound the work to the editor's ancestry; never inspect the message tree. */
export function inputThemeAncestors(element: HTMLElement): HTMLElement[] {
  const ancestors: HTMLElement[] = []
  let current: HTMLElement | null = element
  while (current && ancestors.length < 32) {
    ancestors.push(current)
    current = current.parentElement
  }
  return ancestors
}

function parseColor(value: string): [number, number, number, number] | null {
  if (!value || value === "transparent") return [0, 0, 0, 0]
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(
    value,
  )
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 1)]
}

export function resolveInputTranslationTheme(element: HTMLElement, fallback: Theme): Theme {
  const ancestors = inputThemeAncestors(element)
  const doc = element.ownerDocument
  if (doc.location?.hostname === "discord.com") {
    for (const ancestor of ancestors) {
      if (ancestor.classList.contains("theme-light")) return "light"
      // Discord's darker/midnight variants retain theme-dark on the same root.
      if (ancestor.classList.contains("theme-dark")) return "dark"
    }
  }

  const view = doc.defaultView
  if (!view) return fallback
  const color = [0, 0, 0]
  let coverage = 0
  for (const ancestor of ancestors) {
    const style = view.getComputedStyle(ancestor)
    if (
      (style.backgroundImage && style.backgroundImage !== "none") ||
      (style.opacity && Number(style.opacity) < 1) ||
      (style.filter && style.filter !== "none")
    )
      return fallback
    const rgba = parseColor(style.backgroundColor)
    // Unknown color spaces cannot safely be treated as transparent.
    if (!rgba) return fallback
    const alpha = rgba[3] * (1 - coverage)
    for (let i = 0; i < 3; i++) color[i] = color[i]! + rgba[i]! * alpha
    coverage += alpha
    if (coverage >= 0.999) {
      const linear = color.map((channel) => {
        const srgb = channel / 255
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
      })
      const luminance = linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
      return luminance < 0.179 ? "dark" : "light"
    }
  }
  return fallback
}
