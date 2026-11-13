import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import { ColorPickerPopover, parseColor } from "@/components/ui/base-ui/color-picker"
import { featureConfigAtom, writeFeatureConfigAtom } from "@/fork/config/atoms"
import { i18n } from "@/utils/i18n"
import "./translation-color.css"

// Figma 2234:3431, quick-colour nodes 2377:5084–5114 and 2234:3437–3457.
const COLORS = [
  "#dc3545",
  "#db4325",
  "#ea7a13",
  "#b98708",
  "#759a18",
  "#2c8d53",
  "#129883",
  "#159eb7",
  "#1f8ee6",
  "#5964df",
  "#a15ded",
  "#ed2dae",
]

const BACKGROUND_COLORS = [
  "#f9e4e8",
  "#f9e8df",
  "#fbebd8",
  "#f8f0ce",
  "#edf3d9",
  "#dfeee4",
  "#dcf0eb",
  "#e0f0f4",
  "#e1edf8",
  "#e6e8f9",
  "#eee4f8",
  "#f7e3ef",
]

export const TRANSLATION_COLOR_LABELS = {
  textColor: "options.translation.translationStyle.style.textColor",
  weakened: "options.translation.translationStyle.style.textColor",
  blockquote: "quickTranslation.quoteColor",
  dashedLine: "quickTranslation.dashedLineColor",
  border: "quickTranslation.borderColor",
  background: "quickTranslation.backgroundColor",
} as const

type ColorPreset = keyof typeof TRANSLATION_COLOR_LABELS

export function TranslationColorSetting() {
  const pair = useAtomValue(featureConfigAtom)
  const write = useSetAtom(writeFeatureConfigAtom)
  const [failed, setFailed] = useState(false)
  if (!pair) return null
  const style = pair.mainConfig.pageTranslation.translationNodeStyle
  if (style.isCustom || !(style.preset in TRANSLATION_COLOR_LABELS)) return null
  const preset = style.preset as ColorPreset
  const label = i18n.t(TRANSLATION_COLOR_LABELS[preset])
  const colors = preset === "background" ? BACKGROUND_COLORS : COLORS
  const initial = parseColor(
    preset === "textColor"
      ? "oklch(0.693 0.17 162.48)"
      : preset === "weakened"
        ? "oklch(0.556 0 0)"
        : "oklch(76.034% 0.12361 82.191)",
  )!
  const defaultHex = `#${[initial.r, initial.g, initial.b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`
  const value =
    (preset === "textColor"
      ? pair.forkConfig.translationTextColor
      : pair.forkConfig.translationPresetColors[preset]) ?? defaultHex
  const save = (color: string) => {
    const parsed = parseColor(color)
    if (!parsed) return
    const hex = `#${[parsed.r, parsed.g, parsed.b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`
    setFailed(false)
    const fork =
      preset === "textColor"
        ? { translationTextColor: hex }
        : { translationPresetColors: { [preset]: hex } }
    void write({ fork }).catch(() => setFailed(true))
  }
  return (
    <section className="tb-translation-color" aria-label={label}>
      <div className="tb-color-heading">
        <h3>{label}</h3>
        <p>{i18n.t("quickTranslation.colorDescription")}</p>
      </div>
      <div className="tb-color-swatches">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color.toUpperCase()}
            aria-pressed={value.toLowerCase() === color}
            style={{ color }}
            onClick={() => save(color)}
          >
            <span style={{ backgroundColor: color }} />
          </button>
        ))}
      </div>
      <div className="tb-custom-color">
        <span>{i18n.t("quickTranslation.customColor")}</span>
        <ColorPickerPopover
          value={value}
          format="hex"
          onValueChange={save}
          triggerLabel={label}
          triggerShowValue={false}
          triggerClassName="tb-custom-color-trigger"
          className="tb-color-picker"
        />
        <span className="tb-color-value">{value.toUpperCase()}</span>
      </div>
      {failed && <span role="alert">{i18n.t("quickTranslation.saveFailed")}</span>}
    </section>
  )
}
