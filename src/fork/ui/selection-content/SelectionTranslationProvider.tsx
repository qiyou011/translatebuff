import type { ReactNode } from "react"
import { useMemo } from "react"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { shadowWrapper } from "@/entrypoints/selection.content"
import { SelectionToolbarErrorAlert } from "@/entrypoints/selection.content/components/selection-toolbar-error-alert"
import { SelectionToolbarFooterContent } from "@/entrypoints/selection.content/components/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "@/entrypoints/selection.content/components/selection-toolbar-title-content"
import { TargetLanguageSelector } from "@/entrypoints/selection.content/selection-toolbar/translate-button/target-language-selector"
import { TranslationContent } from "@/entrypoints/selection.content/selection-toolbar/translate-button/translation-content"
import { SelectionTranslationContext } from "./context"
import { useSelectionTranslationController } from "./use-selection-translation-controller"

// fork 翻译浮窗 Provider 薄壳：调 controller → 值塞进 fork context + 组合翻译 popover JSX
// （镜像上游 provider.tsx :745-797）。已去掉「猜你想存」卡片与 disablePointerDismissal
// （notebase 已切除、无写入方、恒 false，故省略该 prop）。将来重设计只动此壳的 JSX，不污染同步 diff 面。
export function SelectionTranslationProvider({ children }: { children: ReactNode }) {
  const {
    isOpen,
    anchor,
    setAnchor,
    popoverSessionKey,
    selectionText,
    translatedText,
    thinking,
    error,
    isTranslating,
    paragraphsText,
    titleText,
    translateProviders,
    translateRequest,
    handleOpenChange,
    handleProviderChange,
    handleRegenerate,
    prepareToolbarOpen,
  } = useSelectionTranslationController()

  const contextValue = useMemo(() => ({ prepareToolbarOpen }), [prepareToolbarOpen])

  return (
    <SelectionTranslationContext value={contextValue}>
      <SelectionPopover.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        anchor={anchor}
        onAnchorChange={setAnchor}
      >
        {children}
        <SelectionPopover.Content
          key={popoverSessionKey}
          container={shadowWrapper ?? document.body}
          finalFocus={false}
        >
          <SelectionPopover.Header className="border-b">
            <SelectionToolbarTitleContent title="Translation" icon="ri:translate" />
            <div className="flex items-center gap-1">
              <TargetLanguageSelector />
              <SelectionPopover.Pin />
              <SelectionPopover.Close />
            </div>
          </SelectionPopover.Header>

          <SelectionPopover.Body>
            <TranslationContent
              selectionContent={selectionText}
              translatedText={translatedText}
              isTranslating={isTranslating}
              thinking={thinking}
            />
            <SelectionToolbarErrorAlert error={error} className="-mt-3" />
          </SelectionPopover.Body>
          <SelectionToolbarFooterContent
            paragraphsText={paragraphsText}
            providers={translateProviders}
            titleText={titleText}
            value={translateRequest.provider?.id ?? ""}
            onProviderChange={handleProviderChange}
            onRegenerate={handleRegenerate}
          />
        </SelectionPopover.Content>
      </SelectionPopover.Root>
    </SelectionTranslationContext>
  )
}
