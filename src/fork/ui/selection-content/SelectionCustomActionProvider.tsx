import type { ReactNode } from "react"
import { useMemo } from "react"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { shadowWrapper } from "@/entrypoints/selection.content"
import { SelectionToolbarErrorAlert } from "@/entrypoints/selection.content/components/selection-toolbar-error-alert"
import { SelectionToolbarFooterContent } from "@/entrypoints/selection.content/components/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "@/entrypoints/selection.content/components/selection-toolbar-title-content"
import { CustomActionContent } from "@/entrypoints/selection.content/selection-toolbar/custom-action-button/custom-action-content"
import { CustomActionToolButton } from "@/entrypoints/selection.content/selection-toolbar/custom-action-button/custom-action-tool-button"
import { SelectionCustomActionContext } from "./context"
import { useSelectionCustomActionController } from "./use-custom-action-controller"

// fork 自定义动作 Provider 薄壳：调 controller → 值塞进 fork context + 组合动作 popover JSX
// （镜像上游 custom-action-button/provider.tsx :383-440）。已去掉「保存到笔记库」按钮与建库弹窗宿主，
// 且不再传 disablePointerDismissal（notebase 已切除、无写入方、恒 false，故省略该 prop）。
// 将来重设计只动此壳的 JSX，不污染同步 diff 面。
export function SelectionCustomActionProvider({ children }: { children: ReactNode }) {
  const {
    isOpen,
    anchor,
    setAnchor,
    popoverSessionKey,
    bodyRef,
    activeAction,
    selectionText,
    paragraphsText,
    titleText,
    customActionProviders,
    customActionRequest,
    displayedResult,
    displayedError,
    displayedIsRunning,
    displayedThinking,
    handleOpenChange,
    handleProviderChange,
    handleRegenerate,
    openToolbarCustomAction,
  } = useSelectionCustomActionController()

  const contextValue = useMemo(() => ({ openToolbarCustomAction }), [openToolbarCustomAction])

  return (
    <SelectionCustomActionContext value={contextValue}>
      {children}
      <SelectionPopover.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        anchor={anchor}
        onAnchorChange={setAnchor}
      >
        <SelectionPopover.Content
          key={popoverSessionKey}
          container={shadowWrapper ?? document.body}
        >
          <SelectionPopover.Header className="border-b">
            <SelectionToolbarTitleContent
              title={activeAction?.name ?? "Custom Action"}
              icon={activeAction?.icon ?? "tabler:sparkles"}
            />
            <div className="flex items-center gap-1">
              <SelectionPopover.Pin />
              <SelectionPopover.Close />
            </div>
          </SelectionPopover.Header>

          <SelectionPopover.Body ref={bodyRef}>
            <CustomActionContent
              isRunning={displayedIsRunning}
              outputSchema={activeAction?.outputSchema ?? []}
              selectionContent={selectionText}
              value={displayedResult}
              thinking={displayedThinking}
            />
            <SelectionToolbarErrorAlert error={displayedError} />
          </SelectionPopover.Body>
          <SelectionToolbarFooterContent
            paragraphsText={paragraphsText}
            providers={customActionProviders}
            titleText={titleText}
            value={customActionRequest.provider?.id ?? ""}
            onProviderChange={handleProviderChange}
            onRegenerate={handleRegenerate}
          >
            {activeAction && <CustomActionToolButton action={activeAction} />}
          </SelectionToolbarFooterContent>
        </SelectionPopover.Content>
      </SelectionPopover.Root>
    </SelectionCustomActionContext>
  )
}
