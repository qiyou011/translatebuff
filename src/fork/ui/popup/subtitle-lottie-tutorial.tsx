import type { ReactNode } from "react"
import { useTheme } from "@/components/providers/theme-provider"
import cn from "@/fork/assets/lottie/video-cn.lottie.json?url"
import global from "@/fork/assets/lottie/video-global.lottie.json?url"
import { currentEdition } from "@/fork/identity/edition"
import { LottieTutorial } from "./lottie-tutorial"

const sources = { cn, global }

export function SubtitleLottieTutorial({
  label,
  fallback,
}: {
  label: string
  fallback: ReactNode
}) {
  const { theme } = useTheme()
  return (
    <LottieTutorial
      src={sources[currentEdition()]}
      label={label}
      fallback={fallback}
      viewBox={`${theme === "light" ? 44.7 : 492.7} 272.13613 360 202.56387`}
      aspectRatio="360 / 202.56387"
      stillFrame={240}
    />
  )
}
