import { describe, expect, it } from "vitest"
import { INPUT_TRANSLATION_PALETTES } from "../input-translation-palette"

function luminance(hex: string) {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)!
    .map((pair) => {
      const channel = Number.parseInt(pair, 16) / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

describe.each(["light", "dark"] as const)("%s input translation text contrast", (theme) => {
  it.each([
    ["--rf-foreground", "--rf-background"],
    ["--rf-muted-foreground", "--rf-background"],
    ["--rf-popover-foreground", "--rf-popover"],
    ["--rf-foreground", "--rf-input"],
    ["--rf-muted-foreground", "--rf-input"],
    ["--rf-accent-foreground", "--rf-accent"],
  ] as const)("keeps %s on %s at least 4.5:1", (foreground, background) => {
    const colors = INPUT_TRANSLATION_PALETTES[theme]
    const a = luminance(colors[foreground])
    const b = luminance(colors[background])
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5)
  })
})
