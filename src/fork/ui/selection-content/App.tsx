import { useAtomValue } from "jotai"
import { useEffect } from "react"
import { ToastProvider } from "@/components/ui/base-ui/toast"
import { useInputTranslation } from "@/entrypoints/selection.content/input-translation"
import {
  SELECTION_CONTENT_OVERLAY_LAYERS,
  SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE,
} from "@/entrypoints/selection.content/overlay-layers"
import { useContextMenuReadAloud } from "@/entrypoints/selection.content/use-context-menu-read-aloud"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SelectionCustomActionProvider } from "./SelectionCustomActionProvider"
import { SelectionToolbar } from "./SelectionToolbar"
import { SelectionTranslationProvider } from "./SelectionTranslationProvider"

// fork 翻译浮窗壳根。签名 / props（{ uiContainer, portalContainer }）与上游 app.tsx 一致，故
// 注入层 selection.content/index.tsx 靠 `import App from "./app"`（shim 后 re-export 本文件）零改动挂载。
// 编排镜像上游 app.tsx，只把三个 provider / toolbar 换成 fork 版；useInputTranslation /
// useContextMenuReadAloud / --rf-selection-opacity 保留以维持功能对等。
//
// D4 三元组绑定不变量（必守，否则运行时崩）：
//   Provider（SelectionTranslationProvider / SelectionCustomActionProvider）
//   + Toolbar（SelectionToolbar）
//   + 触发按钮（TranslateButton / CustomActionTrigger，由 Toolbar 渲染）
//   三者必须同为 fork 版、共用 fork 自建 context（./context）。
//   任一若改回 import 上游 provider，将读上游 module-private context → 运行时抛
//   "must be used within Provider"。三者同进同出，禁 import 上游 provider。
export default function App({
  uiContainer,
  portalContainer,
}: {
  uiContainer: HTMLElement
  portalContainer: ShadowRoot
}) {
  useInputTranslation()
  useContextMenuReadAloud()
  const opacity = useAtomValue(configFieldsAtomMap.selectionToolbar).opacity / 100

  useEffect(() => {
    uiContainer.style.setProperty("--rf-selection-opacity", String(opacity))

    return () => {
      uiContainer.style.removeProperty("--rf-selection-opacity")
    }
  }, [opacity, uiContainer])

  return (
    <ToastProvider
      portalProps={{ container: portalContainer }}
      viewportProps={{
        className: SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay,
        ...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" },
      }}
    >
      <SelectionTranslationProvider>
        <SelectionCustomActionProvider>
          <SelectionToolbar />
        </SelectionCustomActionProvider>
      </SelectionTranslationProvider>
    </ToastProvider>
  )
}
