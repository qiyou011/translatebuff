// @vitest-environment jsdom
import type { ReactNode } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useSelectionSpeech } from "@/entrypoints/selection.content/selection-toolbar/speak-button"
import App from "../App"

vi.mock("@/entrypoints/selection.content", () => ({ shadowWrapper: null }))
vi.mock("@/hooks/use-text-to-speech", () => ({
  useTextToSpeech: () => ({
    play: vi.fn<() => void>(),
    stop: vi.fn<() => void>(),
    isFetching: false,
    isPlaying: false,
  }),
}))
vi.mock("@/entrypoints/selection.content/use-context-menu-read-aloud", () => ({
  useContextMenuReadAloud: () => {},
}))
vi.mock("@/components/ui/base-ui/toast", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  toastManager: { add: vi.fn<() => void>() },
}))
vi.mock("../input-translation", () => ({
  useInputTranslation: () => ({}),
  InputTranslationBar: () => null,
}))
vi.mock("../SelectionCustomActionProvider", () => ({
  SelectionCustomActionProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("../SelectionTranslationProvider", () => ({
  SelectionTranslationProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("../SelectionToolbar", () => ({
  SelectionToolbar: () => {
    const speech = useSelectionSpeech()
    return <span data-testid="shared-speech">{speech.label}</span>
  },
}))

afterEach(cleanup)
it("mounts the shared speech provider around the actual fork toolbar shell", () => {
  const host = document.createElement("div")
  const portalContainer = host.attachShadow({ mode: "open" })
  const uiContainer = document.createElement("div")
  render(<App uiContainer={uiContainer} portalContainer={portalContainer} />)
  expect(screen.getByTestId("shared-speech").textContent).toBeTruthy()
  expect(uiContainer.style.getPropertyValue("--rf-selection-opacity")).toBe("1")
})
