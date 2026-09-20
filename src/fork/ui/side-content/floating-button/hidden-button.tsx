import type { FloatingButtonSide } from "@/types/config/floating-button"
import { FloatingButtonTooltip } from "@/entrypoints/side.content/components/floating-button/components/floating-button-tooltip"
import { cn } from "@/utils/styles/utils"

export default function HiddenButton({
  icon,
  label,
  onClick,
  children,
  className,
  side = "right",
  expanded = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  children?: React.ReactNode
  className?: string
  side?: FloatingButtonSide
  expanded?: boolean
}) {
  return (
    <FloatingButtonTooltip
      content={label}
      side={side}
      render={
        <button
          type="button"
          aria-label={label}
          className={cn(
            "relative flex size-7 cursor-pointer items-center justify-center rounded-[17px] bg-white text-[#525252] shadow-[inset_0_0_0_0.5px_#d4d4d4,0_4px_3px_rgba(0,0,0,0.1),0_10px_7.5px_rgba(0,0,0,0.1)] transition-[transform,background-color] duration-300 hover:bg-white active:bg-white dark:bg-[#171717] dark:text-[#a3a3a3] dark:shadow-[inset_0_0_0_0.5px_#404040,0_4px_3px_rgba(0,0,0,0.1),0_10px_7.5px_rgba(0,0,0,0.1)] dark:hover:bg-[#171717] dark:active:bg-[#171717]",
            side === "right" ? "mr-[9px]" : "ml-[9px]",
            expanded ? "translate-x-0" : side === "right" ? "translate-x-12" : "-translate-x-12",
            className,
          )}
          onClick={onClick}
        />
      }
    >
      {icon}
      {children}
    </FloatingButtonTooltip>
  )
}
