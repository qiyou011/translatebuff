import type { CSSProperties } from "react"
import type { Theme } from "@/types/config/theme"

type Palette = CSSProperties & Record<`--rf-${string}`, string>

/** Opaque surfaces keep contrast independent of the message/image underneath. */
export const INPUT_TRANSLATION_PALETTES = {
  dark: {
    colorScheme: "dark",
    "--rf-background": "#29292D",
    "--rf-foreground": "#F2F3F5",
    "--rf-muted-foreground": "#B5BAC1",
    "--rf-popover": "#29292D",
    "--rf-popover-foreground": "#F2F3F5",
    "--rf-input": "#202127",
    "--rf-border": "#606570",
    "--rf-ring": "#B5BAC1",
    "--rf-accent": "#3B3C43",
    "--rf-accent-foreground": "#F2F3F5",
  },
  light: {
    colorScheme: "light",
    "--rf-background": "#F7F7F8",
    "--rf-foreground": "#202127",
    "--rf-muted-foreground": "#606570",
    "--rf-popover": "#F7F7F8",
    "--rf-popover-foreground": "#202127",
    "--rf-input": "#FFFFFF",
    "--rf-border": "#B5BAC1",
    "--rf-ring": "#606570",
    "--rf-accent": "#E4E5E9",
    "--rf-accent-foreground": "#202127",
  },
} as const satisfies Record<Theme, Palette>
