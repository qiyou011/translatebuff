import type { ReactNode } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import { browser } from "#imports"
import translateIcon from "@/assets/images/panel-v170/toolbar-brand-icon.svg?url&no-inline"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { SelectionToolbarErrorAlert } from "@/components/ui/selection-popover/selection-toolbar-error-alert"
import { SelectionToolbarFooterContent } from "@/components/ui/selection-popover/selection-toolbar-footer-content"
import { shadowWrapper } from "@/entrypoints/selection.content"
import { TargetLanguageSelector } from "@/entrypoints/selection.content/selection-toolbar/translate-button/target-language-selector"
import { TranslationContent } from "@/entrypoints/selection.content/selection-toolbar/translate-button/translation-content"
import { featureConfigAtom, writeFeatureConfigAtom } from "@/fork/config/atoms"
import { SelectionTranslationContext } from "./context"
import { useSelectionTranslationController } from "./use-selection-translation-controller"
import "./selection-ui.css"

// fork 翻译浮窗 Provider 薄壳：调 controller → 值塞进 fork context + 组合翻译 popover JSX
// （镜像上游 provider.tsx :745-797）。已去掉「猜你想存」卡片与 disablePointerDismissal
// （notebase 已切除、无写入方、恒 false，故省略该 prop）。将来重设计只动此壳的 JSX，不污染同步 diff 面。
export function SelectionTranslationProvider({ children }: { children: ReactNode }) {
  const featureConfig = useAtomValue(featureConfigAtom)
  const writeFeatureConfig = useSetAtom(writeFeatureConfigAtom)
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
    popoverActionsRef,
    handleOpenChange,
    handleReuseRequest,
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
        actionsRef={popoverActionsRef}
        onReuseRequest={handleReuseRequest}
      >
        {children}
        <SelectionPopover.Content
          className="tb-selection-popover"
          key={popoverSessionKey}
          container={shadowWrapper ?? document.body}
          finalFocus={false}
        >
          <SelectionPopover.Header className="border-b">
            <span className="tb-selection-title">
              <img
                src={new URL(translateIcon, browser.runtime.getURL("/")).href}
                width={18}
                height={18}
                alt=""
                className="tb-selection-translate-icon"
              />
              Translation
            </span>
            <div className="flex items-center gap-1">
              <TargetLanguageSelector
                disabled={!featureConfig}
                targetCode={featureConfig?.forkConfig.featureLanguages.selection.targetCode}
                onTargetCodeChange={(targetCode) => {
                  void writeFeatureConfig({
                    fork: { featureLanguages: { selection: { targetCode } } },
                  })
                }}
              />
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
            className="tb-selection-footer"
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
