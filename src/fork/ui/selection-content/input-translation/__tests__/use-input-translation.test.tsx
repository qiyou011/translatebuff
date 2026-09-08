// @vitest-environment jsdom

import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
  within,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeContext } from "@/components/providers/theme-provider"
import { InputTranslationBar as TranslationBar } from "../input-translation-bar"

type Animate = Element["animate"]
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const translateTextForInputMock = vi.fn<(...args: any[]) => any>()
const toastAddMock = vi.fn<(...args: any[]) => any>()
const getLocalConfigMock = vi.fn<(...args: any[]) => any>()
const getDetectedCodeMock = vi.fn<(...args: any[]) => any>()
let execCommandMock: ReturnType<typeof vi.fn<() => boolean>>

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForInput: (...args: any[]) => translateTextForInputMock(...args),
}))
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: (...args: any[]) => toastAddMock(...args) },
}))
vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: (...args: any[]) => getLocalConfigMock(...args),
}))
vi.mock("@/utils/config/languages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/config/languages")>()),
  getDetectedCodeFromStorage: (...args: any[]) => getDetectedCodeMock(...args),
}))
// 埋点与 provider 解析不是本测试的对象，直通即可。
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureAttempt: (_ctx: unknown, run: () => unknown) => run(),
}))
vi.mock("@/utils/analytics-provider", () => ({ classifyResolvedProvider: () => ({}) }))
vi.mock("@/utils/providers/provider-registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/providers/provider-registry")>()),
  resolveProviderRefForCapability: () => ({ kind: "local", config: {} }),
}))

const { useInputTranslation } = await import("../use-input-translation")

function deferredTranslation() {
  let resolve!: (value: string) => void
  let reject!: (error: Error) => void
  const promise = new Promise<string>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function settleDeferred(
  request: ReturnType<typeof deferredTranslation>,
  settlement: "resolve" | "reject",
  value: string,
) {
  await act(async () => {
    if (settlement === "resolve") request.resolve(value)
    else request.reject(new Error(value))
  })
}

function clickLikeBrowser(target: HTMLElement) {
  fireEvent.pointerDown(target)
  const shouldFocus = fireEvent.mouseDown(target)
  if (shouldFocus) target.focus()
  fireEvent.pointerUp(target)
  fireEvent.mouseUp(target)
  fireEvent.click(target)
}

function activateButtonFromKeyboard(target: HTMLElement) {
  target.focus()
  fireEvent.keyDown(target, { key: "Enter" })
  fireEvent.keyUp(target, { key: "Enter" })
  fireEvent.click(target)
}

function deepActiveElement(root: Document | ShadowRoot): Element | null {
  let active = root.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

describe("Discord request feedback and stale-result protection", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    document.execCommand = vi.fn<(_command: string, _show: boolean, value: string) => boolean>(
      (_command, _show, value) => {
        const element = document.activeElement
        if (element instanceof HTMLInputElement) element.value = value
        return true
      },
    )
    Element.prototype.animate = vi.fn<() => { cancel: () => void }>(() => ({
      cancel: vi.fn<() => void>(),
    })) as unknown as Animate
    window.matchMedia = vi.fn<() => { matches: boolean }>(() => ({
      matches: false,
    })) as unknown as typeof window.matchMedia
    vi.stubGlobal("location", new URL("https://discord.com/channels/1/2"))
    translateTextForInputMock.mockReset().mockResolvedValue("Привет")
    toastAddMock.mockReset()
    getDetectedCodeMock.mockReset().mockResolvedValue("deu")
    getLocalConfigMock.mockReset()
    sessionStorage.clear()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  function setup() {
    const config = configWith({ sourceCode: "auto", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    const input = setupPage(RUSSIAN_CHAT)
    return { input, config, rendered: renderWithConfig(config) }
  }

  async function translated() {
    const context = setup()
    act(pressSpaceThrice)
    await waitFor(() => expect(context.input.value).toBe("Привет"))
    return context
  }

  async function renderSurface(rootKind: "document" | "shadow") {
    const { input, config, rendered } = setup()
    rendered.unmount()
    const store = createStore()
    store.set(configAtom, config)
    function Surface() {
      const api = useInputTranslation()
      return (
        <TranslationBar
          bar={api.bar}
          onRetranslate={api.retranslate}
          onRetry={api.retry}
          onUndo={api.undo}
          onDismiss={api.dismiss}
          onInteractionElementChange={api.setInteractionElement}
          onLanguageMenuOpenChange={api.setLanguageMenuOpen}
        />
      )
    }
    const host = document.createElement("div")
    document.body.append(host)
    const queryRoot = rootKind === "shadow" ? host.attachShadow({ mode: "open" }) : host
    const container = document.createElement("div")
    queryRoot.append(container)
    render(
      <Provider store={store}>
        <ThemeContext value={{ theme: "dark", themeMode: "dark", setThemeMode: () => {} }}>
          <Surface />
        </ThemeContext>
      </Provider>,
      { container },
    )
    const focusRoot = queryRoot instanceof ShadowRoot ? queryRoot : document
    return { input, queries: within(queryRoot as HTMLElement), focusRoot, host }
  }

  it("shows pending language and spinner without replacing the successful draft", async () => {
    const { input, rendered } = await translated()
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    act(() => {
      void rendered.result.current.retranslate("jpn")
    })
    expect(rendered.result.current.bar).toMatchObject({
      pendingLang: "jpn",
      feedback: { kind: "pending" },
    })
    expect(input.value).toBe("Привет")
    expect(document.getElementById("read-frog-input-translation-spinner")).not.toBeNull()
    act(() => {
      void rendered.result.current.retranslate("eng")
    })
    expect(translateTextForInputMock).toHaveBeenCalledTimes(2)
    await act(async () => request.resolve("こんにちは"))
    expect(input.value).toBe("こんにちは")
    expect(rendered.result.current.bar).toMatchObject({ lang: "jpn", langSource: "manual" })
    expect(document.getElementById("read-frog-input-translation-spinner")).toBeNull()
  })

  it.each(["resolve", "reject"] as const)(
    "undo invalidates the pending translation before a late %s",
    async (settlement) => {
      const { input, rendered } = await translated()
      const request = deferredTranslation()
      translateTextForInputMock.mockReturnValue(request.promise)
      act(() => {
        void rendered.result.current.retranslate("jpn")
      })
      act(() => rendered.result.current.undo())
      await settleDeferred(request, settlement, "late Japanese")
      expect(input.value).toBe("你好呀，最近怎么样")
      expect(rendered.result.current.bar).toBeNull()
    },
  )

  it("rolls back a failed language and retries the displayed successful language", async () => {
    const { input, rendered } = await translated()
    translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
    await act(async () => {
      await rendered.result.current.retranslate("jpn")
    })
    expect(input.value).toBe("Привет")
    expect(rendered.result.current.bar).toMatchObject({
      lang: "rus",
      feedback: { kind: "error", retryable: true },
    })
    const retryButton = document.createElement("button")
    document.body.append(retryButton)
    act(() => {
      rendered.result.current.setInteractionElement(retryButton)
      retryButton.focus()
    })
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    act(() => {
      void rendered.result.current.retry()
    })
    expect(document.activeElement).toBe(input)
    expect(rendered.result.current.bar).toMatchObject({ feedback: { kind: "pending" } })
    expect(translateTextForInputMock).toHaveBeenLastCalledWith("你好呀，最近怎么样", "cmn", "rus")
    await act(async () => request.resolve("Привет снова"))
    expect(input.value).toBe("Привет снова")
  })

  it("shows a first-failure notice and succeeds on retry without requiring another hotkey", async () => {
    const { input, rendered } = setup()
    translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
    act(pressSpaceThrice)
    await waitFor(() =>
      expect(rendered.result.current.bar).toMatchObject({
        kind: "initial",
        feedback: { kind: "error", retryable: true },
      }),
    )
    expect(input.value).toBe("你好呀，最近怎么样")
    expect(toastAddMock).not.toHaveBeenCalled()
    await act(async () => {
      await rendered.result.current.retry()
    })
    expect(input.value).toBe("Привет")
    expect(rendered.result.current.bar).toMatchObject({ kind: "translated" })
  })

  it("does not flip enableCycle a second time on first-failure retry", async () => {
    const { input, config, rendered } = setup()
    config.inputTranslation = { ...config.inputTranslation, enableCycle: true }
    rendered.unmount()
    const cycled = renderWithConfig(config)
    translateTextForInputMock.mockRejectedValueOnce(new Error("timeout"))
    act(pressSpaceThrice)
    await waitFor(() => expect(cycled.result.current.bar?.kind).toBe("initial"))
    expect(translateTextForInputMock).toHaveBeenLastCalledWith(input.value, "rus", "cmn")
    await act(async () => {
      await cycled.result.current.retry()
    })
    expect(translateTextForInputMock).toHaveBeenLastCalledWith("你好呀，最近怎么样", "rus", "cmn")
  })

  it.each([
    ["Escape", "resolve"],
    ["Escape", "reject"],
    ["unmount", "resolve"],
    ["unmount", "reject"],
    ["remove", "resolve"],
    ["remove", "reject"],
    ["route", "resolve"],
    ["route", "reject"],
  ] as const)("invalidates even the first request on %s before %s", async (action, settlement) => {
    const { input, rendered } = setup()
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    act(pressSpaceThrice)
    await waitFor(() => expect(translateTextForInputMock).toHaveBeenCalled())
    act(() => {
      if (action === "Escape")
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      if (action === "unmount") rendered.unmount()
      if (action === "remove") input.remove()
      if (action === "route") vi.stubGlobal("location", new URL("https://discord.com/channels/1/3"))
    })
    await act(async () => {
      if (settlement === "resolve") request.resolve("must not write")
      else request.reject(new Error("must not publish"))
    })
    expect(input.value).toBe("你好呀，最近怎么样")
    expect(document.getElementById("read-frog-input-translation-spinner")).toBeNull()
  })

  it.each(["resolve", "reject"] as const)(
    "invalidates edits even when the user changes the draft back (ABA) before %s",
    async (settlement) => {
      const { input, rendered } = await translated()
      const request = deferredTranslation()
      translateTextForInputMock.mockReturnValue(request.promise)
      act(() => {
        void rendered.result.current.retranslate("jpn")
      })
      act(() => {
        input.value = "changed"
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.value = "Привет"
        input.dispatchEvent(new Event("input", { bubbles: true }))
      })
      await settleDeferred(request, settlement, "must not write")
      expect(input.value).toBe("Привет")
      expect(rendered.result.current.bar).toMatchObject({
        lang: "rus",
        originalText: "你好呀，最近怎么样",
      })
      expect(rendered.result.current.bar).not.toHaveProperty("pendingLang", "jpn")
      act(() => rendered.result.current.undo())
      expect(input.value).toBe("你好呀，最近怎么样")
    },
  )

  it("holds a completed result while blurred and commits only when the same editor refocuses", async () => {
    const { input, rendered } = await translated()
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    act(() => {
      void rendered.result.current.retranslate("jpn")
    })
    const other = document.createElement("input")
    other.value = "other draft"
    document.body.append(other)
    act(() => other.focus())
    await waitFor(() => expect(rendered.result.current.bar).toBeNull())
    await act(async () => request.resolve("こんにちは"))
    expect(document.activeElement).toBe(other)
    expect(input.value).toBe("Привет")
    expect(other.value).toBe("other draft")
    act(() => input.focus())
    await waitFor(() => expect(input.value).toBe("こんにちは"))
  })

  it("first-failure retry also survives blur and commits on editor refocus", async () => {
    const { input, rendered } = setup()
    translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
    act(pressSpaceThrice)
    await waitFor(() => expect(rendered.result.current.bar?.kind).toBe("initial"))
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    act(() => {
      void rendered.result.current.retry()
    })
    const outside = document.createElement("button")
    document.body.append(outside)
    act(() => outside.focus())
    await waitFor(() => expect(rendered.result.current.bar).toBeNull())
    await act(async () => request.resolve("recovered"))
    expect(input.value).toBe("你好呀，最近怎么样")
    act(() => input.focus())
    await waitFor(() => expect(input.value).toBe("recovered"))
  })

  it("an error arriving during blur becomes visible on editor refocus", async () => {
    const { input, rendered } = setup()
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    act(pressSpaceThrice)
    await waitFor(() => expect(translateTextForInputMock).toHaveBeenCalledOnce())
    const outside = document.createElement("button")
    document.body.append(outside)
    act(() => outside.focus())
    await act(async () => request.reject(new Error("network error")))
    expect(rendered.result.current.bar).toBeNull()
    act(() => input.focus())
    expect(rendered.result.current.bar).toMatchObject({
      kind: "initial",
      feedback: { kind: "error" },
    })
  })

  it.each(["resolve", "reject"] as const)(
    "an old %s finally cannot release the new request lock or remove its spinner",
    async (settlement) => {
      const { input, rendered } = await translated()
      const old = deferredTranslation()
      translateTextForInputMock.mockReturnValueOnce(old.promise)
      act(() => {
        void rendered.result.current.retranslate("jpn")
      })
      act(() => rendered.result.current.undo())
      const next = deferredTranslation()
      translateTextForInputMock.mockReturnValueOnce(next.promise)
      act(pressSpaceThrice)
      await waitFor(() => expect(translateTextForInputMock).toHaveBeenCalledTimes(3))
      await settleDeferred(old, settlement, "old result")
      expect(input.value).toBe("你好呀，最近怎么样")
      expect(document.getElementById("read-frog-input-translation-spinner")).not.toBeNull()
      act(pressSpaceThrice)
      expect(translateTextForInputMock).toHaveBeenCalledTimes(3)
      await act(async () => next.resolve("new result"))
      expect(input.value).toBe("new result")
    },
  )

  it("exits pending on empty results without changing the successful language", async () => {
    const { input, rendered } = await translated()
    translateTextForInputMock.mockResolvedValueOnce("")
    await act(async () => {
      await rendered.result.current.retranslate("jpn")
    })
    expect(input.value).toBe("Привет")
    expect(rendered.result.current.bar).toMatchObject({ lang: "rus" })
    expect(rendered.result.current.bar).not.toHaveProperty("feedback.kind", "pending")
  })

  it("keeps original whitespace independently of normalized translation input", async () => {
    const { input, rendered } = setup()
    input.value = "  你好呀，最近怎么样  "
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
      input.value += " "
      input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
      input.value += " "
      input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
    })
    await waitFor(() => expect(input.value).toBe("Привет"))
    act(() => rendered.result.current.undo())
    expect(input.value).toBe("  你好呀，最近怎么样  ")
  })

  it("paste between spaces starts a new trigger sequence and preserves the pasted original", async () => {
    const { input, rendered } = setup()
    input.value = "draft A"
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
      input.value = "draft A pasted B"
      input.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: "pasted B" }),
      )
      input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
      input.value += " "
      input.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: " " }),
      )
      input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
      input.value += " "
      input.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: " " }),
      )
    })
    await act(async () => {})
    expect(translateTextForInputMock).not.toHaveBeenCalled()
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
    })
    await waitFor(() => expect(input.value).toBe("Привет"))
    act(() => rendered.result.current.undo())
    expect(input.value).toBe("draft A pasted B")
  })

  it.each(["document", "shadow"] as const)(
    "selecting a language through the real menu preserves focus and pending in %s DOM",
    async (rootKind) => {
      const { input, queries } = await renderSurface(rootKind)
      act(pressSpaceThrice)
      await queries.findByRole("combobox")
      const request = deferredTranslation()
      translateTextForInputMock.mockReturnValue(request.promise)
      fireEvent.click(queries.getByRole("combobox"))
      const search = await queries.findByPlaceholderText("translationHub.searchLanguages")
      act(() => search.focus())
      fireEvent.change(search, { target: { value: "jpn" } })
      clickLikeBrowser(await queries.findByRole("option", { name: /jpn/ }))
      await waitFor(() =>
        expect(queries.queryByPlaceholderText("translationHub.searchLanguages")).toBeNull(),
      )
      expect(document.activeElement).toBe(input)
      expect(queries.getByText("inputTranslationBar.translating")).toBeVisible()
      expect(queries.getByRole("combobox")).toBeDisabled()
      expect(queries.getByRole("button", { name: "inputTranslationBar.undo" })).toBeEnabled()
      await act(async () => request.resolve("こんにちは"))
      await waitFor(() => expect(input.value).toBe("こんにちは"))
    },
  )

  it.each(["document", "shadow"] as const)(
    "returns focus to the trigger when an empty search closes with Escape in %s DOM",
    async (rootKind) => {
      const { queries, focusRoot } = await renderSurface(rootKind)
      act(pressSpaceThrice)
      const trigger = await queries.findByRole("combobox")
      fireEvent.click(trigger)
      const search = await queries.findByPlaceholderText("translationHub.searchLanguages")
      act(() => search.focus())
      fireEvent.change(search, { target: { value: "no-language-can-match-this" } })
      await queries.findByText("translationHub.noLanguagesFound")
      fireEvent.keyDown(search, { key: "Escape" })
      await waitFor(() => expect(search.isConnected).toBe(false))
      await waitFor(() => expect(deepActiveElement(focusRoot)).toBe(trigger))
      expect(queries.getByRole("button", { name: "inputTranslationBar.undo" })).toBeEnabled()
    },
  )

  it.each(["sibling", "host"] as const)(
    "does not pull focus from a ShadowRoot %s when an old popup Escape event closes the menu",
    async (targetKind) => {
      const { queries, focusRoot, host } = await renderSurface("shadow")
      act(pressSpaceThrice)
      const trigger = await queries.findByRole("combobox")
      fireEvent.click(trigger)
      const search = await queries.findByPlaceholderText("translationHub.searchLanguages")
      act(() => search.focus())
      const sibling = document.createElement("button")
      focusRoot.append(sibling)
      host.tabIndex = -1
      const target = targetKind === "sibling" ? sibling : host
      act(() => target.focus())
      fireEvent.keyDown(search, { key: "Escape" })
      await waitFor(() => expect(search.isConnected).toBe(false))
      expect(deepActiveElement(document)).toBe(target)
    },
  )

  it.each([
    ["document", "Escape"],
    ["document", "outside"],
    ["shadow", "Escape"],
    ["shadow", "outside"],
  ] as const)(
    "resets committed final focus before a %s DOM menu closes via %s without selection",
    async (rootKind, closeKind) => {
      const { input, queries, focusRoot } = await renderSurface(rootKind)
      act(pressSpaceThrice)
      await queries.findByRole("combobox")
      translateTextForInputMock.mockResolvedValueOnce("こんにちは")
      fireEvent.click(queries.getByRole("combobox"))
      let search = await queries.findByPlaceholderText("translationHub.searchLanguages")
      fireEvent.change(search, { target: { value: "jpn" } })
      clickLikeBrowser(await queries.findByRole("option", { name: /jpn/ }))
      await waitFor(() => expect(input.value).toBe("こんにちは"))
      const focusEditor = vi.spyOn(input, "focus")

      fireEvent.click(queries.getByRole("combobox"))
      search = await queries.findByPlaceholderText("translationHub.searchLanguages")
      // Wait for Base UI's real opening autofocus; manually focusing here leaves its
      // queued animation-frame focus pending and races the subsequent outside click.
      await waitFor(() => expect(deepActiveElement(document)).toBe(search))
      const outside = document.createElement("button")
      document.body.append(outside)
      if (closeKind === "Escape") {
        fireEvent.keyDown(search, { key: "Escape" })
      } else {
        clickLikeBrowser(outside)
      }

      await waitFor(() => expect(search.isConnected).toBe(false))
      const expectedFocus = closeKind === "Escape" ? queries.getByRole("combobox") : outside
      const expectedFocusRoot = closeKind === "Escape" ? focusRoot : document
      await waitFor(() => expect(deepActiveElement(expectedFocusRoot)).toBe(expectedFocus))
      expect(focusEditor).not.toHaveBeenCalled()
      expect(input.value).toBe("こんにちは")
      focusEditor.mockRestore()
      expect(queries.queryByRole("button", { name: "inputTranslationBar.undo" }) !== null).toBe(
        closeKind === "Escape",
      )
      if (closeKind === "outside") {
        act(() => input.focus())
        await queries.findByRole("button", { name: "inputTranslationBar.undo" })
      }
    },
  )

  it.each([
    ["document", "initial"],
    ["document", "translated"],
    ["shadow", "initial"],
    ["shadow", "translated"],
  ] as const)(
    "keeps focus and feedback continuous for %s DOM %s Retry",
    async (rootKind, failureKind) => {
      const { input, queries } = await renderSurface(rootKind)
      if (failureKind === "initial") {
        translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
        act(pressSpaceThrice)
      } else {
        act(pressSpaceThrice)
        await queries.findByRole("combobox")
        translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
        fireEvent.click(await queries.findByRole("combobox"))
        const search = await queries.findByPlaceholderText("translationHub.searchLanguages")
        fireEvent.change(search, { target: { value: "jpn" } })
        clickLikeBrowser(await queries.findByRole("option", { name: /jpn/ }))
      }
      const retry = await queries.findByRole("button", { name: "inputTranslationBar.retry" })
      const request = deferredTranslation()
      translateTextForInputMock.mockReturnValue(request.promise)
      const callsBeforeRetry = translateTextForInputMock.mock.calls.length
      act(() => activateButtonFromKeyboard(retry))
      act(() => activateButtonFromKeyboard(retry))
      await waitFor(() =>
        expect(translateTextForInputMock).toHaveBeenCalledTimes(callsBeforeRetry + 1),
      )
      expect(document.activeElement).toBe(input)
      expect(queries.getByText("inputTranslationBar.translating")).toBeVisible()
      const expectedDisabled = failureKind === "translated" ? true : null
      expect(queries.queryByRole("combobox")?.hasAttribute("disabled") ?? null).toBe(
        expectedDisabled,
      )
      const expectedUndoDisabled = failureKind === "translated" ? false : null
      expect(
        queries
          .queryByRole("button", { name: "inputTranslationBar.undo" })
          ?.hasAttribute("disabled") ?? null,
      ).toBe(expectedUndoDisabled)
      await act(async () => request.resolve("retry result"))
      await waitFor(() => expect(input.value).toBe("retry result"))
    },
  )

  it.each(["document", "shadow"] as const)(
    "supports keyboard language selection and layered Escape dismissal in %s DOM",
    async (rootKind) => {
      const { input, queries, focusRoot } = await renderSurface(rootKind)
      act(pressSpaceThrice)
      const trigger = await queries.findByRole("combobox")
      translateTextForInputMock.mockResolvedValueOnce("hello")
      fireEvent.click(trigger)
      const search = await queries.findByPlaceholderText("translationHub.searchLanguages")
      fireEvent.change(search, { target: { value: "English" } })
      fireEvent.keyDown(search, { key: "ArrowDown" })
      fireEvent.keyDown(search, { key: "Enter" })
      await waitFor(() => expect(input.value).toBe("hello"))

      fireEvent.click(queries.getByRole("combobox"))
      const reopenedSearch = await queries.findByPlaceholderText("translationHub.searchLanguages")
      act(() => reopenedSearch.focus())
      fireEvent.keyDown(reopenedSearch, { key: "Escape" })
      await waitFor(() => expect(reopenedSearch.isConnected).toBe(false))
      await waitFor(() => expect(deepActiveElement(focusRoot)).toBe(trigger))
      expect(queries.queryByRole("button", { name: "inputTranslationBar.undo" })).not.toBeNull()
      const reopenedTrigger = queries.getByRole("combobox")
      fireEvent.keyDown(reopenedTrigger, { key: "Escape" })
      await waitFor(() =>
        expect(queries.queryByRole("button", { name: "inputTranslationBar.undo" })).toBeNull(),
      )
    },
  )

  it("restores a retryable error after Retry fails again without duplicate requests", async () => {
    const { rendered } = setup()
    translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
    act(pressSpaceThrice)
    await waitFor(() => expect(rendered.result.current.bar?.kind).toBe("initial"))
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    const callsBeforeRetry = translateTextForInputMock.mock.calls.length
    act(() => {
      void rendered.result.current.retry()
      void rendered.result.current.retry()
    })
    await waitFor(() =>
      expect(translateTextForInputMock).toHaveBeenCalledTimes(callsBeforeRetry + 1),
    )
    await act(async () => request.reject(new Error("network error again")))
    expect(rendered.result.current.bar).toMatchObject({
      kind: "initial",
      feedback: { kind: "error", retryable: true },
    })
    expect(document.getElementById("read-frog-input-translation-spinner")).toBeNull()
  })

  it("dismisses a first Retry empty result without duplicate requests", async () => {
    const { rendered } = setup()
    translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
    act(pressSpaceThrice)
    await waitFor(() => expect(rendered.result.current.bar?.kind).toBe("initial"))
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    const callsBeforeRetry = translateTextForInputMock.mock.calls.length
    act(() => {
      void rendered.result.current.retry()
      void rendered.result.current.retry()
    })
    await waitFor(() =>
      expect(translateTextForInputMock).toHaveBeenCalledTimes(callsBeforeRetry + 1),
    )
    await act(async () => request.resolve(""))
    expect(rendered.result.current.bar).toBeNull()
    expect(document.getElementById("read-frog-input-translation-spinner")).toBeNull()
  })

  it("hands first-failure Retry focus back before publishing pending", async () => {
    const { input, rendered } = setup()
    translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
    act(pressSpaceThrice)
    await waitFor(() => expect(rendered.result.current.bar?.kind).toBe("initial"))
    const retryButton = document.createElement("button")
    document.body.append(retryButton)
    act(() => {
      rendered.result.current.setInteractionElement(retryButton)
      retryButton.focus()
    })
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    act(() => {
      void rendered.result.current.retry()
    })
    expect(document.activeElement).toBe(input)
    expect(rendered.result.current.bar).toMatchObject({ feedback: { kind: "pending" } })
    await act(async () => request.resolve("recovered"))
    expect(input.value).toBe("recovered")
  })

  it.each(["empty", "draft", "route", "dismiss", "remove"] as const)(
    "does not start an old inline action when focus synchronously changes %s ownership",
    async (change) => {
      const { input, rendered } = await translated()
      const interactionButton = document.createElement("button")
      document.body.append(interactionButton)
      act(() => {
        rendered.result.current.setInteractionElement(interactionButton)
        interactionButton.focus()
      })
      input.addEventListener(
        "focus",
        () => {
          if (change === "empty") input.value = ""
          if (change === "draft") input.value = "host changed draft"
          if (change === "route") window.history.pushState({}, "", "/focus-handoff-changed")
          if (change === "dismiss") rendered.result.current.dismiss()
          if (change === "remove") input.remove()
        },
        { once: true },
      )
      const callsBeforeAction = translateTextForInputMock.mock.calls.length
      await act(async () => {
        await rendered.result.current.retranslate("jpn")
      })
      expect(translateTextForInputMock).toHaveBeenCalledTimes(callsBeforeAction)
      if (change === "remove")
        await waitFor(() => {
          if (rendered.result.current.bar !== null) throw new Error("removed session still present")
        })
      expect(rendered.result.current.bar === null).toBe(
        change === "empty" || change === "dismiss" || change === "remove",
      )
      expect(document.getElementById("read-frog-input-translation-spinner")).toBeNull()
    },
  )

  it("lets a new editor request started during focus handoff own the spinner and result", async () => {
    const { input, rendered } = await translated()
    const interactionButton = document.createElement("button")
    const nextInput = document.createElement("input")
    nextInput.value = "next draft"
    document.body.append(interactionButton, nextInput)
    act(() => {
      rendered.result.current.setInteractionElement(interactionButton)
      interactionButton.focus()
    })
    const nextRequest = deferredTranslation()
    translateTextForInputMock.mockReturnValue(nextRequest.promise)
    input.addEventListener(
      "focus",
      () => {
        input.remove()
        nextInput.focus()
        pressSpaceThrice()
      },
      { once: true },
    )
    const callsBeforeAction = translateTextForInputMock.mock.calls.length
    await act(async () => {
      await rendered.result.current.retranslate("jpn")
    })
    await waitFor(() =>
      expect(translateTextForInputMock).toHaveBeenCalledTimes(callsBeforeAction + 1),
    )
    expect(document.activeElement).toBe(nextInput)
    expect(document.getElementById("read-frog-input-translation-spinner")).not.toBeNull()
    await act(async () => nextRequest.resolve("next result"))
    expect(nextInput.value).toBe("next result")
    expect(document.getElementById("read-frog-input-translation-spinner")).toBeNull()
  })

  it("language resolution failure releases the lock so a later attempt works", async () => {
    const { input, rendered, config } = setup()
    getLocalConfigMock.mockRejectedValueOnce(new Error("resolution failed"))
    act(pressSpaceThrice)
    await waitFor(() => expect(rendered.result.current.bar?.kind).toBe("initial"))
    getLocalConfigMock.mockResolvedValue(config)
    await act(async () => {
      await rendered.result.current.retry()
    })
    expect(input.value).toBe("Привет")
    expect(document.getElementById("read-frog-input-translation-spinner")).toBeNull()
  })

  it("missing config on retry cannot leave an orphaned pending notice", async () => {
    const { rendered } = setup()
    translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
    act(pressSpaceThrice)
    await waitFor(() => expect(rendered.result.current.bar?.kind).toBe("initial"))
    getLocalConfigMock.mockResolvedValue(null)
    await act(async () => {
      await rendered.result.current.retry()
    })
    expect(rendered.result.current.bar).toMatchObject({
      feedback: { kind: "error", retryable: true },
    })
    expect(document.getElementById("read-frog-input-translation-spinner")).toBeNull()
  })

  it("a pending retranslation cannot refill the editor after an actual send", async () => {
    const { input, rendered } = await translated()
    const request = deferredTranslation()
    translateTextForInputMock.mockReturnValue(request.promise)
    act(() => {
      void rendered.result.current.retranslate("jpn")
    })
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
      input.value = ""
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => request.resolve("must not send twice"))
    expect(input.value).toBe("")
    expect(rendered.result.current.bar).toBeNull()
  })

  it("terminal first failure in explicit mode still has feedback but cannot retry", async () => {
    const { config, rendered } = setup()
    rendered.unmount()
    config.language = { ...config.language, sourceCode: "eng" }
    const explicit = renderWithConfig(config)
    translateTextForInputMock.mockRejectedValueOnce(new Error("data_inspection_failed"))
    act(pressSpaceThrice)
    await waitFor(() =>
      expect(explicit.result.current.bar).toMatchObject({
        kind: "initial",
        feedback: { retryable: false },
      }),
    )
    await act(async () => {
      await explicit.result.current.retry()
    })
    expect(translateTextForInputMock).toHaveBeenCalledOnce()
  })

  it("closes stale first-error notice when the original input is edited", async () => {
    const { input, rendered } = setup()
    translateTextForInputMock.mockRejectedValueOnce(new Error("network error"))
    act(pressSpaceThrice)
    await waitFor(() => expect(rendered.result.current.bar?.kind).toBe("initial"))
    act(() => {
      input.value = "new original"
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(rendered.result.current.bar).toBeNull()
    act(pressSpaceThrice)
    await waitFor(() =>
      expect(rendered.result.current.bar).toMatchObject({ originalText: "new original" }),
    )
  })

  it("keeps unregistered pages free of Discord correction UI", async () => {
    const { input, rendered } = setup()
    vi.stubGlobal("location", new URL("https://example.com"))
    act(pressSpaceThrice)
    await waitFor(() => expect(input.value).toBe("Привет"))
    expect(rendered.result.current.bar).toBeNull()
  })
})

const RUSSIAN_CHAT = [
  "Элис, еще раз добрый день! У меня появились срочные обстоятельства.",
  "Поэтому я смогу очень мало времени уделять стримам, к сожалению.",
]

function configWith(language: Partial<Config["language"]>): Config {
  return { ...DEFAULT_CONFIG, language: { ...DEFAULT_CONFIG.language, ...language } }
}

/** 铺一个 Discord 形态的对话，并返回已聚焦的输入框。 */
function setupPage(messages: string[]): HTMLInputElement {
  document.body.innerHTML = `${messages
    .map(
      (text, index) =>
        `<li id="chat-messages-${index}"><div id="message-content-${index}">${text}</div></li>`,
    )
    .join("")}<input id="composer" />`
  const input = document.getElementById("composer") as HTMLInputElement
  input.value = "你好呀，最近怎么样"
  input.focus()
  return input
}

function pressSpaceThrice() {
  for (let i = 0; i < 3; i++) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
  }
}

function renderWithConfig(config: Config) {
  const store = createStore()
  store.set(configAtom, config)
  return renderHook(() => useInputTranslation(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    ),
  })
}

type InputTranslationLifecycleApi = {
  setInteractionElement?: (element: HTMLElement | null) => void
  setLanguageMenuOpen?: (open: boolean) => void
}

function lifecycleApi(rendered: ReturnType<typeof renderWithConfig>) {
  return rendered.result.current as typeof rendered.result.current & InputTranslationLifecycleApi
}

describe("useInputTranslation 的语言解析", () => {
  beforeEach(() => {
    // 以下三个都是 jsdom 的缺口，不补桩会在到达断言前就抛，且异常被 `void handleTranslation()`
    // 吞掉，表现为「什么都没发生」。execCommand 用于替换输入框内容，animate 用于 spinner 转圈。
    execCommandMock = vi.fn<() => boolean>(() => true)
    document.execCommand = execCommandMock
    Element.prototype.animate = vi.fn<() => { cancel: () => void }>(() => ({
      cancel: vi.fn<() => void>(),
    })) as unknown as Animate
    window.matchMedia = vi.fn<() => { matches: boolean }>(() => ({
      matches: false,
    })) as unknown as typeof window.matchMedia
    vi.stubGlobal("location", new URL("https://discord.com/channels/1/2"))
    translateTextForInputMock.mockReset().mockResolvedValue("Привет")
    toastAddMock.mockReset()
    getDetectedCodeMock.mockReset().mockResolvedValue("deu")
    getLocalConfigMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.body.innerHTML = ""
  })

  it("把解析出的具体语言码交给引擎，而不是 sourceCode 这种选项字面量", async () => {
    const config = configWith({ sourceCode: "auto", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    setupPage(RUSSIAN_CHAT)
    renderWithConfig(config)

    pressSpaceThrice()

    await waitFor(() => {
      expect(translateTextForInputMock).toHaveBeenCalledWith(
        "你好呀，最近怎么样",
        "cmn", // fromLang: targetCode
        "rus", // toLang: sourceCode → 跟随对话
      )
    })
  })

  it("解析后两端语言相同时不调引擎，改在输入框上方挂提示条", async () => {
    // 对话是俄语，用户的目标语言也设成俄语 → 无事可做。
    const config = configWith({ sourceCode: "auto", targetCode: "rus" })
    getLocalConfigMock.mockResolvedValue(config)
    setupPage(RUSSIAN_CHAT)
    const rendered = renderWithConfig(config)

    pressSpaceThrice()

    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())
    expect(rendered.result.current.bar).toMatchObject({ kind: "sameLanguage" })
    expect(translateTextForInputMock).not.toHaveBeenCalled()
    // 提示挪进内联条后，toast 这条路就该断掉，否则同一件事说两遍。
    expect(toastAddMock).not.toHaveBeenCalled()
  })

  it("用户钉死源语言时不被对话检测顶掉", async () => {
    const config = configWith({ sourceCode: "eng", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    setupPage(RUSSIAN_CHAT)
    renderWithConfig(config)

    pressSpaceThrice()

    await waitFor(() => {
      expect(translateTextForInputMock).toHaveBeenCalledWith("你好呀，最近怎么样", "cmn", "eng")
    })
  })
})

describe("useInputTranslation 的内联条", () => {
  beforeEach(() => {
    execCommandMock = vi.fn<() => boolean>(() => true)
    document.execCommand = execCommandMock
    Element.prototype.animate = vi.fn<() => { cancel: () => void }>(() => ({
      cancel: vi.fn<() => void>(),
    })) as unknown as Animate
    window.matchMedia = vi.fn<() => { matches: boolean }>(() => ({
      matches: false,
    })) as unknown as typeof window.matchMedia
    vi.stubGlobal("location", new URL("https://discord.com/channels/1/2"))
    translateTextForInputMock.mockReset().mockResolvedValue("Привет")
    toastAddMock.mockReset()
    getDetectedCodeMock.mockReset().mockResolvedValue("deu")
    getLocalConfigMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.body.innerHTML = ""
  })

  function renderTranslating() {
    const config = configWith({ sourceCode: "auto", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    const input = setupPage(RUSSIAN_CHAT)
    const rendered = renderWithConfig(config)
    return { input, rendered }
  }

  function renderSameLanguage() {
    const config = configWith({ sourceCode: "auto", targetCode: "rus" })
    getLocalConfigMock.mockResolvedValue(config)
    const input = setupPage(RUSSIAN_CHAT)
    const rendered = renderWithConfig(config)
    return { input, rendered }
  }

  it("替换成功后挂出内联条，带上语言与它的来源", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()

    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())
    expect(rendered.result.current.bar).toMatchObject({
      kind: "translated",
      element: input,
      originalText: "你好呀，最近怎么样",
      lang: "rus",
      langSource: "chatContext",
    })
  })

  it("回退整页源语言时，来源标成 pageSource 而不是 chatContext", async () => {
    const config = configWith({ sourceCode: "auto", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    setupPage(["👍", "🎉"]) // 判不出语种 → 回退
    const rendered = renderWithConfig(config)
    pressSpaceThrice()

    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())
    expect(rendered.result.current.bar).toMatchObject({ langSource: "pageSource" })
  })

  it("翻译期间用户改了输入、系统放弃替换时，不挂内联条", async () => {
    let resolveTranslation: (value: string) => void = () => {}
    translateTextForInputMock.mockImplementation(
      () => new Promise<string>((resolve) => (resolveTranslation = resolve)),
    )
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()

    await waitFor(() => expect(translateTextForInputMock).toHaveBeenCalled())
    input.value = "用户又改了别的"
    await act(async () => {
      resolveTranslation("Привет")
    })

    expect(rendered.result.current.bar).toBeNull()
  })

  it("撤销把原文写回去", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    input.value = "Привет"
    execCommandMock.mockClear()
    act(() => rendered.result.current.undo())

    expect(execCommandMock).toHaveBeenCalledWith("insertText", false, "你好呀，最近怎么样")
    expect(rendered.result.current.bar).toBeNull()
  })

  it.each([
    ["删除", "Прив"],
    ["修改", "Здравствуйте"],
    ["新增", "Привет! Как дела?"],
  ])("用户%s译文内容后，内联条仍保留且撤销恢复触发时原文", async (_action, edited) => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    input.value = edited
    act(() => {
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })

    expect(rendered.result.current.bar).toMatchObject({
      kind: "translated",
      originalText: "你好呀，最近怎么样",
    })

    execCommandMock.mockClear()
    act(() => rendered.result.current.undo())

    expect(execCommandMock).toHaveBeenCalledWith("insertText", false, "你好呀，最近怎么样")
  })

  it("原输入框已离开文档时，撤销不写入任何东西", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    input.remove()
    execCommandMock.mockClear()
    act(() => rendered.result.current.undo())

    expect(execCommandMock).not.toHaveBeenCalled()
  })

  it("焦点已切到另一个输入框时，撤销只写回原来那个", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    const other = document.createElement("input")
    other.value = "别动我"
    document.body.appendChild(other)
    other.focus()

    act(() => rendered.result.current.undo())

    // execCommand 作用于当前焦点元素，所以撤销必须先把焦点抢回原输入框。
    expect(document.activeElement).toBe(input)
    expect(other.value).toBe("别动我")
  })

  it("源语言被钉死时不挂内联条——没有自动判定，也就没有要纠错的对象", async () => {
    const config = configWith({ sourceCode: "eng", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    setupPage(RUSSIAN_CHAT)
    const rendered = renderWithConfig(config)

    pressSpaceThrice()

    await waitFor(() => expect(translateTextForInputMock).toHaveBeenCalled())
    expect(rendered.result.current.bar).toBeNull()
  })

  it("改语言后用原文重译，而不是拿已翻译的文本再翻一遍", async () => {
    const { rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    translateTextForInputMock.mockClear().mockResolvedValue("こんにちは")
    await act(async () => {
      await rendered.result.current.retranslate("jpn")
    })

    expect(translateTextForInputMock).toHaveBeenCalledWith("你好呀，最近怎么样", "cmn", "jpn")
    // 原型要求标注由「自动检测」改成「手动选择」，与配置来的 explicit 不是一回事。
    expect(rendered.result.current.bar).toMatchObject({ lang: "jpn", langSource: "manual" })
  })

  it("真正失焦只隐藏翻译内联条，聚焦其他输入框不显示，重新聚焦原输入框后恢复", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    const interaction = document.createElement("div")
    const interactionButton = document.createElement("button")
    const outside = document.createElement("button")
    interaction.appendChild(interactionButton)
    document.body.append(interaction, outside)

    act(() => lifecycleApi(rendered).setInteractionElement?.(interaction))
    act(() => interactionButton.focus())
    expect(rendered.result.current.bar).not.toBeNull()

    act(() => outside.focus())
    await waitFor(() => expect(rendered.result.current.bar).toBeNull())

    const otherInput = document.createElement("input")
    document.body.appendChild(otherInput)
    act(() => otherInput.focus())
    expect(rendered.result.current.bar).toBeNull()

    act(() => input.focus())
    await waitFor(() =>
      expect(rendered.result.current.bar).toMatchObject({
        kind: "translated",
        element: input,
        originalText: "你好呀，最近怎么样",
      }),
    )
  })

  it("语言菜单 Portal 持有焦点时不算失焦，菜单关闭且焦点在外部时暂时隐藏", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    const interaction = document.createElement("div")
    const portalInput = document.createElement("input")
    document.body.append(interaction, portalInput)

    act(() => lifecycleApi(rendered).setInteractionElement?.(interaction))
    act(() => lifecycleApi(rendered).setLanguageMenuOpen?.(true))
    act(() => portalInput.focus())
    expect(rendered.result.current.bar).not.toBeNull()

    act(() => lifecycleApi(rendered).setLanguageMenuOpen?.(false))
    await waitFor(() => expect(rendered.result.current.bar).toBeNull())

    act(() => input.focus())
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())
  })

  it("只有 Enter 后输入框实际清空才视为消息发送并关闭内联条", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    input.value = "Привет"
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    expect(rendered.result.current.bar).not.toBeNull()

    input.value = ""
    act(() => {
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await waitFor(() => expect(rendered.result.current.bar).toBeNull())

    const outside = document.createElement("button")
    document.body.appendChild(outside)
    act(() => outside.focus())
    act(() => input.focus())
    expect(rendered.result.current.bar).toBeNull()
  })

  it("Enter 未提交消息以及 Shift+Enter 换行都不关闭内联条", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    input.value = "Привет"
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    expect(rendered.result.current.bar).not.toBeNull()

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }),
      )
    })
    input.value = "Привет\n"
    act(() => {
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(rendered.result.current.bar).not.toBeNull()
  })

  it("语言菜单关闭时按 Esc 关闭内联条", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })

    expect(rendered.result.current.bar).toBeNull()

    const outside = document.createElement("button")
    document.body.appendChild(outside)
    act(() => outside.focus())
    act(() => input.focus())
    expect(rendered.result.current.bar).toBeNull()
  })

  it("语言菜单展开时第一次 Esc 只关闭菜单，下一次才关闭内联条", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    act(() => lifecycleApi(rendered).setLanguageMenuOpen?.(true))
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    expect(rendered.result.current.bar).not.toBeNull()

    act(() => lifecycleApi(rendered).setLanguageMenuOpen?.(false))
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    expect(rendered.result.current.bar).toBeNull()
  })

  it("同语言提示在用户继续输入后关闭", async () => {
    const { input, rendered } = renderSameLanguage()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).toMatchObject({ kind: "sameLanguage" }))

    input.value = "你好呀，最近怎么样，补充一句"
    act(() => {
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })

    expect(rendered.result.current.bar).toBeNull()
  })

  it("同语言提示在消息实际发送后关闭", async () => {
    const { input, rendered } = renderSameLanguage()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).toMatchObject({ kind: "sameLanguage" }))

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    input.value = ""
    act(() => {
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })

    expect(rendered.result.current.bar).toBeNull()
  })

  it("同语言提示在按 Esc 后关闭", async () => {
    const { input, rendered } = renderSameLanguage()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).toMatchObject({ kind: "sameLanguage" }))

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })

    expect(rendered.result.current.bar).toBeNull()
  })

  it("同语言提示在焦点真正移到输入框外后永久关闭", async () => {
    const { input, rendered } = renderSameLanguage()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).toMatchObject({ kind: "sameLanguage" }))

    const outside = document.createElement("button")
    document.body.appendChild(outside)
    act(() => outside.focus())

    await waitFor(() => expect(rendered.result.current.bar).toBeNull())

    act(() => input.focus())
    expect(rendered.result.current.bar).toBeNull()
  })
})
