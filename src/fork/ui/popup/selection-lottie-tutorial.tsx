import type { ReactNode } from "react"
import { useTheme } from "@/components/providers/theme-provider"
import dark from "@/fork/assets/lottie/selection-dark.lottie.json?url"
import light from "@/fork/assets/lottie/selection-light.lottie.json?url"
import { LottieTutorial } from "./lottie-tutorial"

export function SelectionLottieTutorial({
  label,
  fallback,
}: {
  label: string
  fallback: ReactNode
}) {
  const { theme } = useTheme()
  return (
    <LottieTutorial
      src={theme === "light" ? light : dark}
      label={label}
      fallback={fallback}
      viewBox={`${theme === "light" ? 36 : 484} 265.64575 376 250.35428`}
      aspectRatio="376 / 250.35428"
      stillFrame={390}
    />
  )
}
