// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { isCurrentSiteInBlacklistAtom } from "@/entrypoints/popup/atoms/site-control"
import App from "../App"

const openOptions = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<void>>())
vi.mock("../input-lottie-tutorial", () => ({ InputLottieTutorial: () => <div /> }))
vi.mock("../subtitle-lottie-tutorial", () => ({ SubtitleLottieTutorial: () => <div /> }))
vi.mock("../selection-lottie-tutorial", () => ({ SelectionLottieTutorial: () => <div /> }))
vi.mock("@/utils/navigation", () => ({ openOptionsPage: openOptions }))
vi.mock("@/fork/ui/feature-settings", () => ({
  FEATURE_LABELS: { page: "page", selection: "selection", input: "input", subtitles: "subtitles" },
  FEATURE_ROUTES: {
    page: "/page-translation",
    selection: "/selection-toolbar",
    input: "/input-translation",
    subtitles: "/video-subtitles",
  },
  FeatureSettings: ({ feature }: { feature: string }) => (
    <div data-testid={`settings-${feature}`} />
  ),
}))
vi.mock("@/fork/ui/popup/account-menu", () => ({ ForkAccountMenu: () => null }))
vi.mock("@/fork/ui/popup/translation-mode-selector", () => ({ default: () => null }))
vi.mock("@/entrypoints/popup/components/ai-smart-context", () => ({ AISmartContext: () => null }))
vi.mock("@/entrypoints/popup/components/always-translate", () => ({ AlwaysTranslate: () => null }))
vi.mock("@/entrypoints/popup/components/node-translation-hotkey-selector", () => ({
  default: () => null,
}))
vi.mock("@/entrypoints/popup/components/site-control-toggle", () => ({
  SiteControlToggle: () => null,
}))
vi.mock("../translate-button", () => ({ default: () => null }))
vi.mock("@/entrypoints/popup/components/translate-prompt-selector", () => ({ default: () => null }))
vi.mock("@/entrypoints/popup/components/translation-hub-button", () => ({
  TranslationHubButton: () => null,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("popup quick panels", () => {
  it("closes an open panel when the site is paused and makes it available after resuming", async () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "input" }))
    await screen.findByRole("dialog")
    act(() => store.set(isCurrentSiteInBlacklistAtom, true))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("status")).toHaveTextContent("quickTranslation.sitePaused")
    expect(screen.getByRole("button", { name: "input" })).toBeDisabled()
    expect(document.querySelector(".tb-translation-card")).toHaveAttribute("inert")
    act(() => store.set(isCurrentSiteInBlacklistAtom, false))
    expect(screen.getByRole("button", { name: "input" })).not.toBeDisabled()
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "input" }))
    expect(await screen.findByRole("dialog")).toBeTruthy()
  })
  it.each(["selection", "input", "subtitles"])(
    "opens %s over page settings, routes correctly and restores focus on Escape",
    async (feature) => {
      render(<App />)
      expect(screen.getByTestId("settings-page")).toBeTruthy()
      const trigger = screen.getByRole("button", { name: feature })
      fireEvent.click(trigger)
      const dialog = await screen.findByRole("dialog")
      expect(within(dialog).getByTestId(`settings-${feature}`)).toBeTruthy()
      fireEvent.click(within(dialog).getByRole("button", { name: /quickTranslation.allSettings/ }))
      expect(openOptions).toHaveBeenCalledWith({
        route: {
          selection: "/selection-toolbar",
          input: "/input-translation",
          subtitles: "/video-subtitles",
        }[feature],
      })
      fireEvent.keyDown(dialog, { key: "Escape" })
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(trigger))
    },
  )

  it("dismisses with close and outside click; the comic/image entry is unavailable", async () => {
    render(<App />)
    expect(
      screen.getByRole("button", { name: /quickTranslation.comicImage/ }).hasAttribute("disabled"),
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "input" }))
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: /Close/ }),
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    fireEvent.click(screen.getByRole("button", { name: "input" }))
    await screen.findByRole("dialog")
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]')!
    fireEvent.mouseDown(backdrop)
    fireEvent.click(backdrop)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
