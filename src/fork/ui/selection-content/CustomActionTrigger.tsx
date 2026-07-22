import type { MouseEvent } from "react"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import { useCallback } from "react"
import { SelectionToolbarTooltip } from "@/entrypoints/selection.content/components/selection-tooltip"
import { useSelectionCustomActionContext } from "./context"

// fork 自定义动作触发按钮（镜像上游 custom-action-button/custom-action-trigger.tsx）。D4 三元组绑定：
// 消费 fork 自建 context（./context），绝不 import 上游 provider——上游 context 是 module-private，
// 混用运行时抛 "must be used within Provider"。
export function CustomActionTrigger({ action }: { action: SelectionToolbarCustomAction }) {
  const { openToolbarCustomAction } = useSelectionCustomActionContext()

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.currentTarget.blur()
      openToolbarCustomAction(action.id, event.currentTarget)
    },
    [action.id, openToolbarCustomAction],
  )

  return (
    <SelectionToolbarTooltip
      content={action.name}
      render={
        <button
          type="button"
          aria-label={action.name}
          className="flex h-7 shrink-0 cursor-pointer items-center justify-center px-2 hover:bg-accent"
          onClick={handleClick}
        />
      }
    >
      <Icon icon={action.icon} strokeWidth={0.8} className="size-4.5" />
    </SelectionToolbarTooltip>
  )
}
