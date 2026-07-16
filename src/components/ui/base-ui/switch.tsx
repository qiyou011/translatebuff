"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import * as React from "react"
import { cn } from "@/utils/styles/utils"

type SwitchProps = Omit<SwitchPrimitive.Root.Props, "onCheckedChange"> & {
  size?: "sm" | "default"
  /**
   * Callback fired when the checked state changes.
   * API compatible with old Radix-based shadcn Switch.
   */
  onCheckedChange?: (checked: boolean) => void
}

function Switch({ className, size = "default", onCheckedChange, ...props }: SwitchProps) {
  const handleCheckedChange = React.useCallback(
    (checked: boolean, _eventDetails: unknown) => {
      onCheckedChange?.(checked)
    },
    [onCheckedChange],
  )

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-control outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      onCheckedChange={handleCheckedChange}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-background shadow-sm ring-0 transition-transform duration-200 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-4 group-data-[size=sm]/switch:data-checked:translate-x-3 dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0.5 group-data-[size=sm]/switch:data-unchecked:translate-x-0.5 dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
