import { createContext, use } from "react"

// fork 自建 selection 浮窗 context。上游 SelectionTranslationContext 是 module-private
// （未导出）const——fork 拥有自己的 popover JSX，就必须拥有自己的 context。
// 块2 将在本文件追加 custom-action context；各 context 保持独立、互不耦合。

// ── 翻译 Provider context ──────────────────────────────────────────────
export interface SelectionTranslationContextValue {
  prepareToolbarOpen: () => void
}

export const SelectionTranslationContext = createContext<SelectionTranslationContextValue | null>(
  null,
)

export function useSelectionTranslationContext() {
  const context = use(SelectionTranslationContext)
  if (!context) {
    throw new Error(
      "Selection translation popover must be used within SelectionTranslationProvider.",
    )
  }

  return context
}

// ── 自定义动作 Provider context ─────────────────────────────────────────
// 镜像上游 custom-action-button/provider.tsx 的 module-private context。fork 拥有自己的
// 动作 popover JSX + 触发按钮，故须拥有自己的 context；消费者只在 fork 内（CustomActionTrigger）。
export interface SelectionCustomActionContextValue {
  openToolbarCustomAction: (actionId: string, triggerElement: HTMLElement | null) => void
}

export const SelectionCustomActionContext = createContext<SelectionCustomActionContextValue | null>(
  null,
)

export function useSelectionCustomActionContext() {
  const context = use(SelectionCustomActionContext)
  if (!context) {
    throw new Error(
      "Selection custom action triggers must be used within SelectionCustomActionProvider.",
    )
  }

  return context
}
