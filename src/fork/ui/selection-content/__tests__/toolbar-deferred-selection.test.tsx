// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { getDefaultStore } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  isSelectionToolbarOpenAtom,
  selectionSessionAtom,
} from "@/entrypoints/selection.content/selection-toolbar/atoms"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  DEFERRED_SELECTION_OPEN_EVENT,
  SELECTION_TOOLBAR_READY_EVENT,
} from "@/utils/constants/selection"
import { SelectionToolbar } from "../SelectionToolbar"

vi.mock("@/entrypoints/selection.content", () => ({ shadowWrapper: null }))
vi.mock("../TranslateButton", () => ({ TranslateButton: () => null }))
vi.mock("../CustomActionTrigger", () => ({ CustomActionTrigger: () => null }))
vi.mock("@/entrypoints/selection.content/selection-toolbar/speak-button", () => ({
  SpeakButton: () => null,
}))

const store = getDefaultStore()
let frames: FrameRequestCallback[]
function flushFrames() {
  act(() => {
    frames.splice(0).forEach((run) => run(0))
  })
}
function selectText() {
  const paragraph = document.createElement("p")
  paragraph.textContent = "Frame text selected by the user"
  document.body.append(paragraph)
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  return selection.toString()
}

beforeEach(() => {
  store.set(configAtom, DEFAULT_CONFIG)
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
  Range.prototype.getClientRects = () => [new DOMRect(10, 20, 100, 20)] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect(10, 20, 100, 20)
})
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  window.getSelection()?.removeAllRanges()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("fork toolbar deferred iframe selection", () => {
  it("announces readiness and opens the still-current deferred selection", () => {
    const ready = vi.fn<() => void>()
    window.addEventListener(SELECTION_TOOLBAR_READY_EVENT, ready)
    const text = selectText()
    const { unmount } = render(<SelectionToolbar />)
    expect(ready).toHaveBeenCalledTimes(1)
    expect(window.__READ_FROG_SELECTION_TOOLBAR_READY__).toBe(true)
    void act(() =>
      window.dispatchEvent(
        new CustomEvent(DEFERRED_SELECTION_OPEN_EVENT, { detail: { text, x: 40, y: 80 } }),
      ),
    )
    flushFrames()
    expect(store.get(selectionSessionAtom)?.selectionSnapshot.text).toBe(text)
    expect(store.get(isSelectionToolbarOpenAtom)).toBe(true)
    unmount()
    expect(window.__READ_FROG_SELECTION_TOOLBAR_READY__).toBe(false)
    window.removeEventListener(SELECTION_TOOLBAR_READY_EVENT, ready)
  })

  it("rejects replaced/malformed deferred selections and releases listeners on unmount", () => {
    selectText()
    const { unmount } = render(<SelectionToolbar />)
    for (const detail of [
      { text: "stale", x: 1, y: 2 },
      { text: window.getSelection()?.toString(), x: NaN, y: 2 },
    ]) {
      void act(() =>
        window.dispatchEvent(new CustomEvent(DEFERRED_SELECTION_OPEN_EVENT, { detail })),
      )
      flushFrames()
      expect(store.get(selectionSessionAtom)).toBeNull()
    }
    unmount()
    void act(() =>
      window.dispatchEvent(
        new CustomEvent(DEFERRED_SELECTION_OPEN_EVENT, {
          detail: { text: window.getSelection()?.toString(), x: 1, y: 2 },
        }),
      ),
    )
    flushFrames()
    expect(store.get(selectionSessionAtom)).toBeNull()
  })

  it("does not read complete input value on the actual mouseup/display/cancel path", () => {
    const input = document.createElement("textarea")
    input.value = "Private surrounding paragraph. Selected text."
    document.body.append(input)
    input.focus()
    input.setSelectionRange(31, 39)
    const range = document.createRange()
    range.selectNode(input)
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "Selected",
      rangeCount: 1,
      getRangeAt: () => range,
      anchorNode: range.startContainer,
      focusNode: range.endContainer,
    } as unknown as Selection)
    const reads = vi.spyOn(input, "value", "get")
    render(<SelectionToolbar />)
    fireEvent.mouseUp(input, { clientX: 50, clientY: 70 })
    flushFrames()
    expect(store.get(isSelectionToolbarOpenAtom)).toBe(true)
    expect(reads).not.toHaveBeenCalled()
    fireEvent.mouseDown(document.body)
    expect(store.get(selectionSessionAtom)).toBeNull()
    expect(reads).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
