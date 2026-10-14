// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { walkAndLabelElement, walkAndLabelElementChunked } from "../traversal"

afterEach(() => {
  document.body.innerHTML = ""
})

it.each(["sync", "chunked"])(
  "keeps nested block menu items separate in the %s walk",
  async (mode) => {
    document.body.innerHTML = `<nav id="menu"><span id="outer" style="display:inline-block"><span id="inner" style="display:inline-block"><a style="display:block">First item</a><a style="display:block">Second item</a></span></span></nav>`
    const menu = document.getElementById("menu")!
    if (mode === "chunked") await walkAndLabelElementChunked(menu, "nested", DEFAULT_CONFIG)
    else walkAndLabelElement(menu, "nested", DEFAULT_CONFIG)

    expect(menu).not.toHaveAttribute(PARAGRAPH_ATTRIBUTE)
    for (const id of ["outer", "inner"]) {
      expect(document.getElementById(id)).toHaveAttribute(BLOCK_ATTRIBUTE)
      expect(document.getElementById(id)).not.toHaveAttribute(INLINE_ATTRIBUTE)
    }
    for (const link of menu.querySelectorAll("a")) expect(link).toHaveAttribute(PARAGRAPH_ATTRIBUTE)
  },
)

it("keeps an inline-block phrase with inline emphasis in its surrounding sentence", () => {
  document.body.innerHTML = `<p id="sentence">Read <span id="phrase" style="display:inline-block">this <em style="display:inline">important</em> phrase</span> carefully.</p>`
  walkAndLabelElement(document.getElementById("sentence")!, "prose", DEFAULT_CONFIG)
  expect(document.getElementById("phrase")).toHaveAttribute(INLINE_ATTRIBUTE)
  expect(document.getElementById("phrase")).not.toHaveAttribute(BLOCK_ATTRIBUTE)
  expect(document.getElementById("sentence")).toHaveAttribute(PARAGRAPH_ATTRIBUTE)
})

it("does not promote an inline container for a hidden block child", () => {
  document.body.innerHTML = `<p id="sentence">Read <span id="phrase" style="display:inline-block">this phrase<span style="display:none">Hidden block</span></span>.</p>`
  walkAndLabelElement(document.getElementById("sentence")!, "hidden", DEFAULT_CONFIG)
  expect(document.getElementById("phrase")).toHaveAttribute(INLINE_ATTRIBUTE)
  expect(document.getElementById("phrase")).not.toHaveAttribute(BLOCK_ATTRIBUTE)
})

it("respects an explicit forced-inline grouping even when a container has block children", () => {
  const config = structuredClone(DEFAULT_CONFIG)
  config.siteRules.userRules = [
    { id: "inline-group", matches: window.location.hostname, forceInlineNodeSelectors: ["#group"] },
  ]
  document.body.innerHTML = `<p id="sentence">Read <span id="group" style="display:inline-block"><span style="display:block">First line</span><span style="display:block">Second line</span></span>.</p>`
  walkAndLabelElement(document.getElementById("sentence")!, "forced-inline", config)
  expect(document.getElementById("group")).toHaveAttribute(INLINE_ATTRIBUTE)
  expect(document.getElementById("group")).not.toHaveAttribute(BLOCK_ATTRIBUTE)
})
