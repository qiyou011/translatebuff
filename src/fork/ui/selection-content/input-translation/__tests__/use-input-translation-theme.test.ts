// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useInputTranslationTheme } from "../use-input-translation-theme"

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function composer(background: string) {
  const input = document.createElement("textarea")
  input.style.background = background
  document.body.append(input)
  return input
}

async function flush() {
  await act(async () => {
    await Promise.resolve() // native MutationObserver microtask
    vi.advanceTimersByTime(32)
  })
}

describe("local theme subscription", () => {
  it("resolves on mount and batches ancestor attributes into a frame", async () => {
    const input = composer("black")
    const { result } = renderHook(() => useInputTranslationTheme(input, "light"))
    expect(result.current.theme).toBe("dark")
    input.style.background = "white"
    await flush()
    expect(result.current.theme).toBe("light")
  })

  it("refreshes on refocus and when the menu opens", () => {
    const input = composer("black")
    const { result } = renderHook(() => useInputTranslationTheme(input, "light"))
    input.style.background = "white"
    act(() => {
      input.dispatchEvent(new FocusEvent("focus"))
    })
    expect(result.current.theme).toBe("light")
    input.style.background = "black"
    act(() => result.current.refresh())
    expect(result.current.theme).toBe("dark")
  })

  it("rebinds for a replacement input and cancels pending work on unmount", async () => {
    const first = composer("black")
    const second = composer("white")
    const { result, rerender, unmount } = renderHook(
      ({ input }) => useInputTranslationTheme(input, "light"),
      { initialProps: { input: first } },
    )
    expect(result.current.theme).toBe("dark")
    rerender({ input: second })
    expect(result.current.theme).toBe("light")
    first.style.background = "white"
    await flush()
    expect(result.current.theme).toBe("light")
    const readStyle = vi.spyOn(window, "getComputedStyle")
    second.style.background = "black"
    await act(async () => {
      await Promise.resolve()
    })
    unmount()
    await flush()
    expect(readStyle).not.toHaveBeenCalled()
  })

  it("does not react to message insertions or unrelated descendant attributes", async () => {
    const input = composer("black")
    const { result } = renderHook(() => useInputTranslationTheme(input, "light"))
    expect(result.current.theme).toBe("dark")
    const readStyle = vi.spyOn(window, "getComputedStyle")
    const message = document.createElement("div")
    document.body.append(message)
    message.className = "new-message"
    await flush()
    expect(readStyle).not.toHaveBeenCalled()
  })
})
