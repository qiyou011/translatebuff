import type { ReactNode } from "react"
import { cn } from "@/utils/styles/utils"

interface GradientBackgroundProps {
  children: ReactNode
  className?: string
}

export function GradientBackground({ children, className }: GradientBackgroundProps) {
  return (
    <div
      className={cn(
        "my-6 flex w-full items-center justify-center overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_top_right,var(--rf-accent),transparent_52%)] p-5 md:p-7",
        className,
      )}
    >
      {children}
    </div>
  )
}
