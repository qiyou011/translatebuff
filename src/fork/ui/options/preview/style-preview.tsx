import type { ComponentProps } from "react"
import { useAtomValue } from "jotai"
import { StylePreview as UpstreamStylePreview } from "@/entrypoints/options/pages/translation/translation-style/style-preview"
import { featureConfigAtom } from "@/fork/config/atoms"
import { i18n } from "@/utils/i18n"
import { TRANSLATION_COLOR_LABELS } from "../translation-color"
import { getPreviewSample } from "./sample"

export * from "@/entrypoints/options/pages/translation/translation-style/style-preview"

// 保留上游 iframe / CSS 装饰逻辑，仅替换未显式传入的示例及其语言属性。
export function StylePreview(props: ComponentProps<typeof UpstreamStylePreview>) {
  const sample = getPreviewSample()
  const pair = useAtomValue(featureConfigAtom)
  const style = pair?.mainConfig.pageTranslation.translationNodeStyle
  const preset = style?.preset
  const colors = pair?.forkConfig.translationPresetColors
  const color =
    preset === "textColor"
      ? pair?.forkConfig.translationTextColor
      : colors?.[preset as keyof NonNullable<typeof colors>]
  if (props.text === undefined)
    return (
      <div className="tb-style-preview">
        <h3>{i18n.t("options.translation.translationStyle.preview")}</h3>
        <p lang="en">A quiet morning walk is a good way to explore the city.</p>
        <UpstreamStylePreview
          {...props}
          className="tb-style-preview-render"
          text={i18n.t("quickTranslation.stylePreviewTranslation")}
          language={sample.language}
        />
        {!style?.isCustom && color && preset && preset in TRANSLATION_COLOR_LABELS && (
          <small>
            {i18n.t(TRANSLATION_COLOR_LABELS[preset as keyof typeof TRANSLATION_COLOR_LABELS])}:{" "}
            {color.toUpperCase()}
          </small>
        )}
      </div>
    )
  return (
    <UpstreamStylePreview
      {...props}
      text={props.text ?? sample.text}
      language={props.language ?? sample.language}
    />
  )
}
