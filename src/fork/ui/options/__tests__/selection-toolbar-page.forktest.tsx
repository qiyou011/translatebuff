// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { ErrorBoundary } from "react-error-boundary"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SelectionToolbarPage } from "@/entrypoints/options/pages/selection-toolbar"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const persisted = vi.hoisted(() => ({ config: null as Config | null }))

// Only the storage boundary is replaced. The page, action section, config atoms,
// feature switches, admission resolver and build redirects stay real.
vi.mock("@/utils/atoms/storage-adapter", () => ({
  storageAdapter: {
    get: async () => structuredClone(persisted.config),
    set: async (_key: string, config: Config) => {
      persisted.config = structuredClone(config)
    },
    setMeta: async () => {},
    watch: () => () => {},
  },
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("fork selection toolbar settings admission", () => {
  it.each([false, true])(
    "keeps local settings usable when the saved cloud suggestion switch is %s",
    async (noteSuggestionEnabled) => {
      persisted.config = structuredClone(DEFAULT_CONFIG)
      persisted.config.selectionToolbar.noteSuggestion.enabled = noteSuggestionEnabled
      const store = createStore()
      store.set(configAtom, structuredClone(persisted.config))
      const network = vi.fn<typeof fetch>()
      vi.stubGlobal("fetch", network)

      const { container } = render(
        <Provider store={store}>
          <MemoryRouter initialEntries={["/selection-toolbar"]}>
            <ErrorBoundary fallbackRender={({ error }) => <div role="alert">{String(error)}</div>}>
              <SelectionToolbarPage />
            </ErrorBoundary>
          </MemoryRouter>
        </Provider>,
      )

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "options.selectionToolbar.title",
      )
      expect(container.querySelector("#selection-toolbar-note-suggestion")).toBeNull()
      expect(container.querySelector("#selection-toolbar-disabled-sites")).not.toBeNull()

      const translate = container.querySelector<HTMLElement>("#selection-toolbar-translate")!
      const previous = store.get(configAtom).selectionToolbar.features.translate.enabled
      fireEvent.click(within(translate).getByRole("switch"))
      await waitFor(() => {
        expect(store.get(configAtom).selectionToolbar.features.translate.enabled).toBe(!previous)
        expect(persisted.config!.selectionToolbar.features.translate.enabled).toBe(!previous)
      })
      expect(container.querySelector("#selection-toolbar-speak")).not.toBeNull()
      expect(store.get(configAtom).selectionToolbar.noteSuggestion.enabled).toBe(
        noteSuggestionEnabled,
      )
      expect(network).not.toHaveBeenCalled()
    },
  )
})
