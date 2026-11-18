import {
  BLOCK_CONTENT_CLASS,
  INLINE_CONTENT_CLASS,
  SPINNER_CLASS,
  TRANSLATION_ERROR_CONTAINER_CLASS,
  TRANSLATION_ONLY_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { deepQueryAllSelector } from "@/utils/host/dom/find"

export function readPageTranslationStatus() {
  const nodes = deepQueryAllSelector(document, (element) =>
    element.matches(
      `.${BLOCK_CONTENT_CLASS}, .${INLINE_CONTENT_CLASS}, [${TRANSLATION_ONLY_ATTRIBUTE}], .${TRANSLATION_ERROR_CONTAINER_CLASS}, .${SPINNER_CLASS}`,
    ),
  )
  return {
    translated: nodes.some((node) =>
      node.matches(
        `.${BLOCK_CONTENT_CLASS}, .${INLINE_CONTENT_CLASS}, [${TRANSLATION_ONLY_ATTRIBUTE}]`,
      ),
    ),
    failed: nodes.some((node) => node.classList.contains(TRANSLATION_ERROR_CONTAINER_CLASS)),
    pending: nodes.some((node) => node.classList.contains(SPINNER_CLASS)),
  }
}
