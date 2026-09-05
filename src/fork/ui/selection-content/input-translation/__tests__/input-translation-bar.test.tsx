// @vitest-environment jsdom

import type { InputTranslationBar as BarState } from "../use-input-translation"
import type { Theme } from "@/types/config/theme"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LanguageCombobox } from "@/components/language-combobox"
import { ThemeContext } from "@/components/providers/theme-provider"
import { InputTranslationBar } from "../input-translation-bar"

// The entrypoint mounts WXT services on import; only the old portal target needs isolating.
vi.mock("@/entrypoints/selection.content", () => ({ shadowWrapper: undefined }))

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  window.matchMedia = vi.fn<typeof window.matchMedia>().mockReturnValue({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    media: "",
    onchange: null,
    addListener() {},
    removeListener() {},
    dispatchEvent: () => true,
  })
})
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function setup(extensionTheme: Theme = "light", background = "black") {
  const element = document.createElement("textarea")
  element.style.background = background
  element.value = "translated draft"
  document.body.append(element)
  const bar: BarState = {
    kind: "translated",
    element,
    originalText: "original draft",
    fromCode: "eng",
    lang: "tha",
    langSource: "chatContext",
  }
  let interaction: HTMLElement | null = null
  const props = {
    bar,
    onRetranslate: vi.fn<(code: string) => void>(),
    onUndo: vi.fn<() => void>(),
    onDismiss: vi.fn<() => void>(),
    onInteractionElementChange: (node: HTMLElement | null) => {
      interaction = node
    },
    onLanguageMenuOpenChange: vi.fn<(open: boolean) => void>(),
  }
  const setThemeMode = vi.fn<() => void>()
  const host = document.createElement("div")
  // Opposing ancestor theme deliberately exercises local isolation.
  host.className = extensionTheme
  document.body.append(host)
  const rendered = render(
    <ThemeContext value={{ theme: extensionTheme, themeMode: extensionTheme, setThemeMode }}>
      <InputTranslationBar {...props} />
    </ThemeContext>,
    { container: host },
  )
  return { ...rendered, element, host, props, setThemeMode, interaction: () => interaction }
}

describe("input translation themed menu", () => {
  it("adapts to the editor without changing the global extension theme", async () => {
    const { host, setThemeMode } = setup()
    await waitFor(() =>
      expect(host.querySelector('[data-input-translation-theme="dark"]')).not.toBeNull(),
    )
    expect(host.className).toBe("light")
    expect(setThemeMode).not.toHaveBeenCalled()
  })

  it("also isolates a light editor beneath the extension's dark ancestor", async () => {
    const { host } = setup("dark", "white")
    await waitFor(() =>
      expect(host.querySelector('[data-input-translation-theme="light"]')).not.toBeNull(),
    )
    expect(host.className).toBe("dark")
  })

  it("keeps the shared selector's default bottom menu outside local styling", async () => {
    render(<LanguageCombobox value="tha" onValueChange={() => {}} />)
    fireEvent.click(screen.getByRole("combobox"))
    const search = await screen.findByPlaceholderText("translationHub.searchLanguages")
    expect(search.closest('[data-slot="combobox-content"]')).toHaveAttribute("data-side", "bottom")
    expect(search.closest(".rf-input-translation-scope")).toBeNull()
  })

  it("keeps an open searchable menu inside the interaction scope through a theme update", async () => {
    const { host, element, props, interaction } = setup()
    fireEvent.click(screen.getByRole("combobox"))
    const search = await screen.findByPlaceholderText("translationHub.searchLanguages")
    // React portal events bubble through the bar; its draft-focus guard must not
    // cancel the search field's native focus/selection interaction.
    expect(fireEvent.mouseDown(search)).toBe(true)
    fireEvent.change(search, { target: { value: "eng" } })
    act(() => search.focus())
    expect(interaction()?.contains(search)).toBe(true)
    expect(host.contains(search)).toBe(true)
    expect(search.closest('[data-slot="combobox-content"]')).toHaveAttribute("data-side", "top")
    element.style.background = "white"
    await waitFor(() =>
      expect(host.querySelector('[data-input-translation-theme="light"]')).not.toBeNull(),
    )
    expect(screen.getByPlaceholderText("translationHub.searchLanguages")).toBe(search)
    expect(search).toHaveValue("eng")
    expect(search).toHaveFocus()
    expect(element.value).toBe("translated draft")
    expect(host.querySelector('input[type="hidden"], input[aria-hidden="true"]')).toHaveValue("tha")
    expect(props.bar.originalText).toBe("original draft")
    expect(props.onRetranslate).not.toHaveBeenCalled()
    expect(props.onDismiss).not.toHaveBeenCalled()
  })
})

describe("input translation menu keyboard boundary", () => {
  async function openShadowMenu() {
    const editor = document.createElement("textarea")
    editor.value = "unchanged Discord draft"
    document.body.append(editor)
    const shadowHost = document.createElement("div")
    document.body.append(shadowHost)
    const shadow = shadowHost.attachShadow({ mode: "open" })
    const wrapper = document.createElement("div")
    shadow.append(wrapper)
    const onRetranslate = vi.fn<(code: string) => void>()
    const rendered = render(
      <ThemeContext value={{ theme: "dark", themeMode: "dark", setThemeMode: () => {} }}>
        <InputTranslationBar
          bar={{
            kind: "translated",
            element: editor,
            originalText: "original",
            fromCode: "eng",
            lang: "tha",
            langSource: "chatContext",
          }}
          onRetranslate={onRetranslate}
          onUndo={() => {}}
          onDismiss={() => {}}
          onInteractionElementChange={() => {}}
          onLanguageMenuOpenChange={() => {}}
        />
      </ThemeContext>,
      { container: wrapper },
    )
    fireEvent.click(wrapper.querySelector('[role="combobox"]')!)
    const search = await waitFor(() => {
      const input = shadow.querySelector<HTMLInputElement>('input[role="combobox"]')
      expect(input).not.toBeNull()
      return input!
    })
    act(() => search.focus())
    return { ...rendered, editor, shadow, wrapper, search, onRetranslate }
  }

  it.each(["keydown", "keypress", "keyup", "paste"])(
    "keeps menu %s away from a host that steals editor focus",
    async (type) => {
      const { editor, shadow, search } = await openShadowMenu()
      const stealFocus = () => {
        editor.focus()
        editor.value += "e"
      }
      document.addEventListener(type, stealFocus)
      try {
        const event = new KeyboardEvent(type, {
          key: "e",
          bubbles: true,
          composed: true,
          cancelable: true,
        })
        act(() => {
          search.dispatchEvent(event)
        })
        expect(shadow.activeElement).toBe(search)
        expect(editor.value).toBe("unchanged Discord draft")
        expect(event.defaultPrevented).toBe(false)
      } finally {
        document.removeEventListener(type, stealFocus)
      }
    },
  )

  it("lets Base UI handle selection before stopping host keyboard handling", async () => {
    const { search, onRetranslate } = await openShadowMenu()
    fireEvent.change(search, { target: { value: "English" } })
    fireEvent.keyDown(search, { key: "ArrowDown", bubbles: true, composed: true })
    fireEvent.keyDown(search, { key: "Enter", bubbles: true, composed: true })
    await waitFor(() => expect(onRetranslate).toHaveBeenCalledWith("eng"))
  })

  it("keeps Escape closing only the menu", async () => {
    const { search, wrapper, onRetranslate } = await openShadowMenu()
    fireEvent.keyDown(search, { key: "Escape", bubbles: true, composed: true })
    await waitFor(() => expect(search.isConnected).toBe(false))
    expect(wrapper.querySelector(".rf-input-translation-shell")).not.toBeNull()
    expect(onRetranslate).not.toHaveBeenCalled()
  })

  it("preserves composition and editing shortcut defaults inside the menu", async () => {
    const { search, shadow, editor } = await openShadowMenu()
    const events = [
      new KeyboardEvent("keydown", {
        key: "Process",
        isComposing: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
      new KeyboardEvent("keydown", {
        key: "a",
        metaKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
      new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    ]
    for (const event of events) {
      act(() => {
        search.dispatchEvent(event)
      })
      expect(event.defaultPrevented).toBe(false)
    }
    expect(shadow.activeElement).toBe(search)
    expect(editor.value).toBe("unchanged Discord draft")
  })

  it("cleans up its keyboard boundary on unmount", async () => {
    const { shadow, unmount } = await openShadowMenu()
    const remove = vi.spyOn(shadow, "removeEventListener")
    unmount()
    for (const type of ["keydown", "keypress", "keyup", "paste"]) {
      expect(remove).toHaveBeenCalledWith(type, expect.any(Function))
    }
    remove.mockRestore()
  })

  it("does not isolate other extension fields or the page editor", async () => {
    const { wrapper, editor } = await openShadowMenu()
    const other = document.createElement("input")
    wrapper.append(other)
    const received: EventTarget[] = []
    const observe = (event: Event) => {
      received.push(event.composedPath()[0]!)
    }
    document.addEventListener("keydown", observe)
    try {
      fireEvent.keyDown(other, { key: "a", bubbles: true, composed: true })
      fireEvent.keyDown(editor, { key: "a", bubbles: true, composed: true })
      expect(received).toEqual([other, editor])
    } finally {
      document.removeEventListener("keydown", observe)
    }
  })
})
