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
      viewBox={`${theme === "light" ? 36.7 : 484.7} 219.13613 374.6 258.76057`}
      aspectRatio="374.6 / 258.76057"
      stillFrame={240}
    />
  )
}
