// @vitest-environment jsdom
import type { FeatureConfigSnapshot } from "../types"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrateFeatureConfig } from "../migration"
import { registerTranslationColorRoot } from "../translation-color"

const mocks = vi.hoisted(() => ({
  publish: undefined as undefined | ((pair: FeatureConfigSnapshot) => void),
  translate: vi.fn<() => void>(),
}))
vi.mock("../storage", () => ({
  subscribeFeatureConfig: (listener: typeof mocks.publish) => {
    mocks.publish = listener
    return () => {}
  },
}))
vi.mock("@/utils/host/translate/translate-text", () => ({ translateTextCore: mocks.translate }))

describe("live translation text color", () => {
  it("updates translated nodes and shadow roots without changing originals, custom CSS or requesting translation", () => {
    document.body.innerHTML =
      '<p id="original">Original text</p><span data-read-frog-custom-translation-style="textColor">译文</span><div id="host"></div>'
    const original = document.querySelector("#original")!.outerHTML
    const shadow = document.querySelector("#host")!.attachShadow({ mode: "open" })
    shadow.innerHTML =
      '<span data-read-frog-custom-translation-style="textColor">翻译</span><span data-read-frog-custom-translation-style="custom" style="color: blue">Custom</span>'
    registerTranslationColorRoot(document)
    registerTranslationColorRoot(shadow)
    const pair = {
      ...migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined),
      revision: "test",
    }
    pair.forkConfig.translationTextColor = "#123456"
    mocks.publish!(pair)
    expect(getComputedStyle(document.querySelector("span")!).color).toBe("rgb(18, 52, 86)")
    expect(shadow.querySelector("style")!.textContent).toContain("#123456")
    document
      .querySelector("span")!
      .setAttribute("data-read-frog-custom-translation-style", "border")
    expect(getComputedStyle(document.querySelector("span")!).color).not.toBe("rgb(18, 52, 86)")
    document
      .querySelector("span")!
      .setAttribute("data-read-frog-custom-translation-style", "textColor")
    expect(getComputedStyle(document.querySelector("span")!).color).toBe("rgb(18, 52, 86)")
    pair.forkConfig.translationTextColor = "red; display:none"
    mocks.publish!(pair)
    expect(document.querySelector("#translatebuff-text-color")!.textContent).toContain("#123456")
    expect(document.querySelector("#original")!.outerHTML).toBe(original)
    expect(
      shadow
        .querySelector('[data-read-frog-custom-translation-style="custom"]')!
        .getAttribute("style"),
    ).toBe("color: blue")
    expect(mocks.translate).not.toHaveBeenCalled()
  })

  it("updates every preset in documents and shadow roots and clears overrides on reset", () => {
    const doc = document.implementation.createHTMLDocument("presets")
    doc.body.innerHTML = '<div id="host"></div>'
    const shadow = doc.querySelector("#host")!.attachShadow({ mode: "open" })
    const pair = {
      ...migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined),
      revision: "test",
    }
    pair.forkConfig.translationPresetColors = {
      weakened: "#123456",
      blockquote: "#234567",
      dashedLine: "#345678",
      border: "#456789",
      background: "#567890",
    }
    registerTranslationColorRoot(doc)
    registerTranslationColorRoot(shadow)
    mocks.publish!(pair)
    const css = doc.querySelector("#translatebuff-text-color")!.textContent
    expect(css).toContain(
      'style="weakened"][data-read-frog-custom-translation-style] { color: #123456',
    )
    expect(css).toContain("border-left-color: #234567")
    expect(css).toContain("text-decoration-color: #345678")
    expect(css).toContain("border-color: #456789")
    expect(css).toContain("background-color: #567890")
    expect(shadow.querySelector("style")!.textContent).toBe(css)
    pair.forkConfig.translationPresetColors.background = "red; display:none"
    mocks.publish!(pair)
    expect(doc.querySelector("style")!.textContent).toBe(css)
    pair.forkConfig.translationPresetColors = {}
    mocks.publish!(pair)
    expect(doc.querySelector("style")!.textContent).toBe("")
    expect(shadow.querySelector("style")!.textContent).toBe("")
    expect(mocks.translate).not.toHaveBeenCalled()
  })
})
