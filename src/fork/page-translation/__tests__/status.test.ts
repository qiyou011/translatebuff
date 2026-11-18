// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest"
import {
  BLOCK_CONTENT_CLASS,
  TRANSLATION_ERROR_CONTAINER_CLASS,
  TRANSLATION_ONLY_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { readPageTranslationStatus } from "../status"
afterEach(() => {
  document.body.innerHTML = ""
})
it("distinguishes pending and failed content from a successful translation", () => {
  expect(readPageTranslationStatus()).toEqual({ translated: false, failed: false, pending: false })
  document.body.innerHTML = `<span class="${TRANSLATION_ERROR_CONTAINER_CLASS}">Failed</span>`
  expect(readPageTranslationStatus()).toEqual({ translated: false, failed: true, pending: false })
  const host = document.createElement("div")
  document.body.append(host)
  host.attachShadow({
    mode: "open",
  }).innerHTML = `<span class="${BLOCK_CONTENT_CLASS}">Translated</span>`
  expect(readPageTranslationStatus()).toEqual({ translated: true, failed: true, pending: false })
})
it("recognizes a completed in-place translation", () => {
  document.body.innerHTML = `<p ${TRANSLATION_ONLY_ATTRIBUTE}>Translated</p>`
  expect(readPageTranslationStatus()).toEqual({ translated: true, failed: false, pending: false })
})
