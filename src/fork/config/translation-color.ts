import type { StyleRoot } from "@/utils/dom/constructable-stylesheets"
import { getRootDocument, isDocumentRoot } from "@/utils/dom/constructable-stylesheets"
import { forkConfigSchema } from "./schema"
import { subscribeFeatureConfig } from "./storage"

const roots = new Set<WeakRef<StyleRoot>>()
const registered = new WeakSet<StyleRoot>()
const STYLE_ID = "translatebuff-text-color"
let css = ""
let subscribed = false

const COLOR_PROPERTIES = {
  textColor: "color",
  weakened: "color",
  blockquote: "border-left-color",
  dashedLine: "text-decoration-color",
  border: "border-color",
  background: "background-color",
} as const

function applyColor(root: StyleRoot) {
  let style = root.querySelector<HTMLStyleElement>(`#${STYLE_ID}`)
  if (!style && !css) return
  if (!style) {
    style = getRootDocument(root).createElement("style")
    style.id = STYLE_ID
    ;(isDocumentRoot(root) ? root.head : root).appendChild(style)
  }
  // Extra specificity wins over the preset sheet regardless of adoption order.
  style.textContent = css
}

export function registerTranslationColorRoot(root: StyleRoot) {
  if (!registered.has(root)) {
    registered.add(root)
    roots.add(new WeakRef(root))
    applyColor(root)
  }
  if (subscribed) return
  subscribed = true
  subscribeFeatureConfig(({ forkConfig }) => {
    const parsed = forkConfigSchema
      .pick({ translationTextColor: true, translationPresetColors: true })
      .safeParse(forkConfig)
    if (!parsed.success) return
    const colors = {
      ...parsed.data.translationPresetColors,
      textColor: parsed.data.translationTextColor,
    }
    const next = Object.entries(COLOR_PROPERTIES)
      .flatMap(([preset, property]) => {
        const color = colors[preset as keyof typeof colors]
        return color
          ? [
              `[data-read-frog-custom-translation-style="${preset}"][data-read-frog-custom-translation-style] { ${property}: ${color} !important; }`,
            ]
          : []
      })
      .join("\n")
    if (next === css) return
    css = next
    for (const reference of roots) {
      const current = reference.deref()
      if (current) applyColor(current)
      else roots.delete(reference)
    }
  })
}
