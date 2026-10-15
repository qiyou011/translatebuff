import type { LexicalEditor } from "lexical"
// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from "lexical"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { replaceText } from "@/entrypoints/input-injector.content/replace-text"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { INPUT_REPLACE_REQUEST_TYPE } from "@/utils/constants/input-injector"
import { useInputTranslation } from "../use-input-translation"

const { translate, getConfig } = vi.hoisted(() => ({
  translate: vi.fn<(...args: unknown[]) => Promise<string>>(),
  getConfig: vi.fn<() => Promise<unknown>>(),
}))
vi.mock("@/utils/host/translate/translate-variants", () => ({ translateTextForInput: translate }))
vi.mock("@/utils/config/storage", () => ({ getLocalConfig: getConfig }))
vi.mock("@/utils/config/languages", async (original) => ({
  ...(await original<typeof import("@/utils/config/languages")>()),
  getDetectedCodeFromStorage: () => Promise.resolve("eng"),
}))
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureAttempt: (_: unknown, run: () => unknown) => run(),
}))
vi.mock("@/utils/providers/provider-registry", async (original) => ({
  ...(await original<typeof import("@/utils/providers/provider-registry")>()),
  isBuiltInAiProviderId: () => false,
  resolveProviderRefForCapability: () => ({ kind: "local", config: {} }),
}))
vi.mock("@/components/ui/base-ui/toast", () => ({ toastManager: { add: vi.fn<() => void>() } }))
const editors: LexicalEditor[] = []
const originalText = "  原始回复，保留首尾空格。  "
function reply(text: string, shadow = false) {
  const host = document.createElement("div")
  document.body.append(host)
  const container = shadow ? host.attachShadow({ mode: "open" }) : host
  const element = document.createElement("div")
  element.setAttribute("contenteditable", "true")
  element.setAttribute("data-lexical-editor", "true")
  element.tabIndex = 0
  Object.defineProperty(element, "isContentEditable", { value: true })
  container.append(element)
  const editor = createEditor({
    onError(error) {
      throw error
    },
  })
  editors.push(editor)
  editor.setRootElement(element)
  editor.update(
    () =>
      $getRoot()
        .append($createParagraphNode().append($createTextNode(text)))
        .selectEnd(),
    { discrete: true },
  )
  return { element, editor }
}
function editorText(editor: LexicalEditor) {
  return editor.getEditorState().read(() => $getRoot().getTextContent())
}
function setup(shadow = false) {
  const config = {
    ...DEFAULT_CONFIG,
    language: {
      ...DEFAULT_CONFIG.language,
      sourceCode: "auto" as const,
      targetCode: "cmn" as const,
    },
  }
  getConfig.mockResolvedValue(config)
  const first = reply("其他回复")
  const target = reply(originalText, shadow)
  target.element.focus()
  const store = createStore()
  store.set(configAtom, config)
  const hook = renderHook(() => useInputTranslation(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    ),
  })
  return { ...target, first, hook }
}
function trigger(element: HTMLElement) {
  act(() => {
    for (let index = 0; index < 3; index++)
      element.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true, composed: true }),
      )
  })
}
beforeEach(() => {
  vi.stubGlobal("location", new URL("https://www.reddit.com/r/test/comments/abc/reply/"))
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
  Element.prototype.animate = vi.fn<() => { cancel: () => void }>(() => ({
    cancel: vi.fn<() => void>(),
  })) as unknown as Element["animate"]
  window.matchMedia = vi.fn<() => { matches: boolean }>(() => ({
    matches: false,
  })) as unknown as typeof window.matchMedia
  vi.spyOn(window, "postMessage").mockImplementation((message) => {
    if (message.type === INPUT_REPLACE_REQUEST_TYPE) replaceText(message.text)
  })
  translate.mockReset().mockResolvedValue("English reply")
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  for (const editor of editors.splice(0)) editor.setRootElement(null)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe("actual fork Reddit Lexical translation", () => {
  it.each([false, true])(
    "translates only the triggering editor and restores immutable whitespace-preserving original on undo (shadow: %s)",
    async (shadow) => {
      const { element, editor, first, hook } = setup(shadow)
      trigger(element)
      await waitFor(() => expect(editorText(editor)).toBe("English reply"))
      expect(editorText(first.editor)).toBe("其他回复")
      expect(hook.result.current.bar).toMatchObject({ kind: "translated", originalText })
      editor.update(
        () =>
          $getRoot()
            .clear()
            .append($createParagraphNode().append($createTextNode("Edited translation"))),
        { discrete: true },
      )
      act(() => hook.result.current.undo())
      expect(editorText(editor)).toBe(originalText)
    },
  )

  it("does not write a delayed response after the user changes the draft", async () => {
    let resolve!: (text: string) => void
    translate.mockReturnValue(
      new Promise<string>((done) => {
        resolve = done
      }),
    )
    const { element, editor } = setup(true)
    trigger(element)
    await waitFor(() => expect(translate).toHaveBeenCalledTimes(1))
    editor.update(
      () =>
        $getRoot()
          .clear()
          .append($createParagraphNode().append($createTextNode("New draft"))),
      { discrete: true },
    )
    void act(() =>
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          composed: true,
          inputType: "insertText",
          data: "x",
        }),
      ),
    )
    await act(async () => resolve("Stale translation"))
    expect(editorText(editor)).toBe("New draft")
  })
})
