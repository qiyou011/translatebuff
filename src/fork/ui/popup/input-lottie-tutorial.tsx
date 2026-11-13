import type { ReactNode } from "react"
import cnDark from "@/assets/images/panel-v170/input-cn-dark.lottie.json?url"
import cnLight from "@/assets/images/panel-v170/input-cn-light.lottie.json?url"
import globalDark from "@/assets/images/panel-v170/input-global-dark.lottie.json?url"
import globalLight from "@/assets/images/panel-v170/input-global-light.lottie.json?url"
import { useTheme } from "@/components/providers/theme-provider"
import { currentEdition } from "@/fork/identity/edition"

const sources = {
  cn: { light: cnLight, dark: cnDark },
  global: { light: globalLight, dark: globalDark },
}

import { LottieTutorial } from "./lottie-tutorial"

export function InputLottieTutorial({ label, fallback }: { label: string; fallback: ReactNode }) {
  const { theme } = useTheme()
  return (
    <LottieTutorial
      src={sources[currentEdition()][theme]}
      label={label}
      fallback={fallback}
      viewBox={`${theme === "light" ? 36.7 : 484.7} 272.9 376 111.8`}
      aspectRatio="376 / 111.8"
      stillFrame={320}
    />
  )
}
