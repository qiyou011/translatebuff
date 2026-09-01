import type { FloatingButtonSide } from "@/types/config/floating-button"
import { cn } from "@/utils/styles/utils"

export default function HiddenButton({
  icon,
  onClick,
  children,
  className,
  side = "right",
  expanded = false,
}: {
  icon: React.ReactNode
  onClick: () => void
  children?: React.ReactNode
  className?: string
  side?: FloatingButtonSide
  expanded?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer rounded-full border border-black bg-black p-1.5 text-white shadow-lg transition-[transform,background-color] duration-300 hover:bg-neutral-800 active:bg-neutral-700",
        side === "right" ? "mr-2" : "ml-2",
        expanded ? "translate-x-0" : side === "right" ? "translate-x-12" : "-translate-x-12",
        className,
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  )
}
