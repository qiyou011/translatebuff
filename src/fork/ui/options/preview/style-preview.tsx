import type { ComponentProps } from "react"
import { StylePreview as UpstreamStylePreview } from "@/entrypoints/options/pages/translation/translation-style/style-preview"
import { getPreviewSample } from "./sample"

export * from "@/entrypoints/options/pages/translation/translation-style/style-preview"

// 保留上游 iframe / CSS 装饰逻辑，仅替换未显式传入的示例及其语言属性。
export function StylePreview(props: ComponentProps<typeof UpstreamStylePreview>) {
  const sample = getPreviewSample()
  return (
    <UpstreamStylePreview
      {...props}
      text={props.text ?? sample.text}
      language={props.language ?? sample.language}
    />
  )
}
