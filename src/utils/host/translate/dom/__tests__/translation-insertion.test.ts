// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BLOCK_CONTENT_CLASS, INLINE_CONTENT_CLASS } from "@/utils/constants/dom-labels"
import { insertTranslatedNodeIntoWrapper } from "../translation-insertion"

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe("footnote translation line height", () => {
  it.each([
    { layout: "block", inherited: "0px", expected: "normal" },
    { layout: "inline", inherited: "0px", expected: "" },
    { layout: "block", inherited: "18px", expected: "" },
  ] as const)(
    "keeps $layout translation readable with $inherited inherited line height",
    async ({ layout, inherited, expected }) => {
      const source = document.createElement("sub")
      source.className = "footnote-source"
      source.textContent = "A footnote whose translated prose spans several lines."
      const wrapper = document.createElement("span")
      source.append(wrapper)
      document.body.append(source)
      const config: Config = {
        ...DEFAULT_CONFIG,
        siteRules: {
          disabledBuiltInRules: [],
          userRules: [
            {
              id: "footnote-layout",
              matches: "*",
              ...(layout === "block"
                ? { forceBlockStyleSelectors: [".footnote-source"] }
                : { forceInlineStyleSelectors: [".footnote-source"] }),
            },
          ],
        },
      }
      // jsdom does not calculate inherited line height; supply the browser's
      // computed value while exercising the real insertion and style decoration.
      const nativeGetComputedStyle = window.getComputedStyle.bind(window)
      vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
        const style = nativeGetComputedStyle(element)
        if (
          element.classList.contains(BLOCK_CONTENT_CLASS) ||
          element.classList.contains(INLINE_CONTENT_CLASS)
        ) {
          style.lineHeight = inherited
        }
        return style
      })

      await insertTranslatedNodeIntoWrapper(
        wrapper,
        { layoutSource: source, sourceText: source.textContent },
        "第一行译文。第二行译文。",
        config.pageTranslation.translationNodeStyle,
        config,
      )

      const translated = wrapper.querySelector<HTMLElement>(
        `.${layout === "block" ? BLOCK_CONTENT_CLASS : INLINE_CONTENT_CLASS}`,
      )!
      expect(translated.textContent).toBe("第一行译文。第二行译文。")
      expect(translated.style.lineHeight).toBe(expected)
    },
  )
})
