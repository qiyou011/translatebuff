// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://discord.com/channels/1/2"}

import { afterEach, describe, expect, it } from "vitest"
import { resolveInputTranslationTheme } from "../input-translation-theme"

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute("class")
  document.documentElement.removeAttribute("style")
  document.body.removeAttribute("style")
})

function composer(background = "transparent") {
  const parent = document.createElement("div")
  const input = document.createElement("textarea")
  input.style.background = background
  parent.append(input)
  document.body.append(parent)
  return { input, parent }
}

describe("input translation local theme", () => {
  it.each([
    ["theme-dark", "white", "light", "dark"],
    ["theme-dark theme-darker", "white", "light", "dark"],
    ["theme-dark theme-midnight", "white", "light", "dark"],
    ["theme-light", "black", "dark", "light"],
  ] as const)(
    "prefers Discord %s over background and extension",
    (marker, bg, fallback, expected) => {
      document.documentElement.className = marker
      expect(resolveInputTranslationTheme(composer(bg).input, fallback)).toBe(expected)
    },
  )

  it("uses the nearest Discord theme scope", () => {
    document.documentElement.className = "theme-dark"
    const { input, parent } = composer()
    parent.className = "theme-light"
    expect(resolveInputTranslationTheme(input, "dark")).toBe("light")
  })

  it.each([
    ["rgb(32, 33, 36)", "light", "dark"],
    ["rgb(247, 247, 248)", "dark", "light"],
  ] as const)("falls through unknown markers to %s background", (bg, fallback, expected) => {
    document.documentElement.className = "theme-future"
    expect(resolveInputTranslationTheme(composer(bg).input, fallback)).toBe(expected)
  })

  it("walks transparent ancestors to an opaque background", () => {
    const { input } = composer()
    document.body.style.background = "rgb(20, 20, 20)"
    expect(resolveInputTranslationTheme(input, "light")).toBe("dark")
  })

  it("composites translucent foreground paint instead of assuming it is white", () => {
    const { input, parent } = composer("rgba(255, 255, 255, 0.1)")
    parent.style.background = "rgba(255, 255, 255, 0.1)"
    document.body.style.background = "black"
    expect(resolveInputTranslationTheme(input, "light")).toBe("dark")
  })

  it.each(["url(test.png)", "linear-gradient(black, white)"])("falls back for %s", (image) => {
    const { input, parent } = composer()
    parent.style.backgroundColor = "black"
    parent.style.backgroundImage = image
    expect(resolveInputTranslationTheme(input, "light")).toBe("light")
  })

  it("does not inspect images hidden behind an opaque input", () => {
    const { input, parent } = composer("black")
    parent.style.backgroundImage = "url(test.png)"
    expect(resolveInputTranslationTheme(input, "light")).toBe("dark")
  })

  it("uses extension theme when no opaque backing can be resolved", () => {
    expect(resolveInputTranslationTheme(composer().input, "dark")).toBe("dark")
  })
})
