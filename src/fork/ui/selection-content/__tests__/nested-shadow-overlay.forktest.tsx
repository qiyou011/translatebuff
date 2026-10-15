// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { getDefaultStore } from "jotai"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  isSelectionToolbarOpenAtom,
  selectionSessionAtom,
} from "@/entrypoints/selection.content/selection-toolbar/atoms"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { SelectionToolbar } from "../SelectionToolbar"

vi.mock("@/entrypoints/selection.content", () => ({ shadowWrapper: null }))
vi.mock("../TranslateButton", () => ({ TranslateButton: () => null }))
vi.mock("../CustomActionTrigger", () => ({ CustomActionTrigger: () => null }))
vi.mock("@/entrypoints/selection.content/selection-toolbar/speak-button", () => ({
  SpeakButton: () => null,
}))

const store = getDefaultStore()
let frames: FrameRequestCallback[]

beforeEach(() => {
  store.set(configAtom, structuredClone(DEFAULT_CONFIG))
  store.set(selectionSessionAtom, null)
  store.set(isSelectionToolbarOpenAtom, false)
  frames = []
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
    frames.push(run)
    return frames.length
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn<() => void>())
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Port of the fixed target's selection-toolbar.test.tsx nested-shadow regression.
// The real toolbar handles mouseup and reads the Selection API. Only selection
// and geometry are supplied because jsdom cannot select text across shadow roots.
// CustomActionContent -> LayoutView creates this second, nested shadow root.
it.each([false, true])(
  "does not capture extension result text as a new page selection (nested shadow: %s)",
  (nested) => {
    const extensionHost = document.createElement("read-frog-selection")
    const extensionRoot = extensionHost.attachShadow({ mode: "open" })
    const mount = document.createElement("div")
    const layoutHost = document.createElement("div")
    extensionRoot.append(mount, layoutHost)
    const layoutRoot = nested ? layoutHost.attachShadow({ mode: "open" }) : extensionRoot
    const layoutText = document.createElement("span")
    layoutText.textContent = "Translated custom action result"
    layoutRoot.append(layoutText)
    const pageElement = document.createElement("p")
    pageElement.textContent = "Page text"
    document.body.append(extensionHost, pageElement)

    render(<SelectionToolbar />, { container: mount })
    const textNode = layoutText.firstChild!
    const range = document.createRange()
    range.selectNodeContents(layoutText)
    Object.defineProperties(range, {
      getClientRects: { value: () => [new DOMRect(10, 20, 100, 20)] },
      getBoundingClientRect: { value: () => new DOMRect(10, 20, 100, 20) },
    })
    vi.spyOn(window, "getSelection").mockReturnValue({
      anchorNode: textNode,
      focusNode: textNode,
      rangeCount: 1,
      toString: () => layoutText.textContent,
      getRangeAt: () => range,
      containsNode: () => true,
    } as unknown as Selection)

    // Matches the target regression: the document-level event target alone
    // cannot identify which shadow tree owns the selection's boundary nodes.
    fireEvent.mouseUp(pageElement, { clientX: 50, clientY: 70 })
    act(() => frames.splice(0).forEach((run) => run(0)))

    expect(store.get(selectionSessionAtom)).toBeNull()
    expect(store.get(isSelectionToolbarOpenAtom)).toBe(false)
    expect(mount.querySelector("[data-slot=selection-toolbar-surface]")?.parentElement).toHaveClass(
      "opacity-0",
    )
  },
)
