// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { storage } from "#imports"
import { AutosaveNavigation } from "@/components/form/autosave-navigation"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { RecoveryBoundary } from "@/components/recovery/recovery-boundary"
import { SidebarProvider } from "@/components/ui/base-ui/sidebar"
import { AnchoredToastProvider, ToastProvider } from "@/components/ui/base-ui/toast"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import App from "@/entrypoints/options/app"
import { AppShell } from "@/entrypoints/options/app-shell"
import { ROUTE_DEFS } from "@/entrypoints/options/app-sidebar/nav-items"
import { SettingsSearch } from "@/entrypoints/options/command-palette/settings-search"
import { ScrollRestoration } from "@/entrypoints/options/navigation/scroll-restoration"
import { saveForkSession } from "@/fork/membership/session"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { configAtom } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { getBuiltInAction } from "@/utils/custom-actions"
import { CUSTOM_ACTION_NOTEBASE_SECTION_ID } from "@/utils/navigation"
import { queryClient } from "@/utils/tanstack-query"
import {
  makeRouteSmokeConfig,
  ROUTE_EXPECTATIONS,
  SMOKE_GLOSSARY_ID,
  SMOKE_GLOSSARY_NAME,
} from "./options-routes-smoke.fixture"

// Only background RPC transport is replaced. Components, configuration atoms,
// storage adapter, membership hooks and all fork admission resolvers stay real.
vi.mock("@/fork/message", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/fork/message")>()),
  sendForkMessage: vi.fn<(type: string) => Promise<unknown>>(async (type) => {
    if (type === "forkSyncMembership" || type === "forkEnsureMembershipKey") return undefined
    if (type === "forkGetInstallChannel") return "route-smoke"
    throw new Error(`Unexpected background RPC during route mount: ${type}`)
  }),
}))

vi.mock("@/utils/db/dexie/db", async () => {
  const { makeGlossaryStorageBoundary } = await import("./options-routes-smoke.fixture")
  return { db: makeGlossaryStorageBoundary() }
})

let activeRouter: ReturnType<typeof createMemoryRouter> | undefined
const originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView")
const originalRangeRects = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects")
const network = vi.fn<typeof fetch>(async () => {
  throw new Error("Options mount unexpectedly attempted fetch")
})

beforeEach(async () => {
  fakeBrowser.reset()
  queryClient.clear()
  await storage.clear("local")
  vi.stubGlobal("fetch", network)
  network.mockClear()
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
  Element.prototype.scrollIntoView = () => {}
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
})

afterEach(() => {
  cleanup()
  activeRouter?.dispose()
  activeRouter = undefined
  queryClient.clear()
  vi.unstubAllGlobals()
  if (originalScrollIntoView)
    Object.defineProperty(Element.prototype, "scrollIntoView", originalScrollIntoView)
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView")
  if (originalRangeRects)
    Object.defineProperty(Range.prototype, "getClientRects", originalRangeRects)
  else Reflect.deleteProperty(Range.prototype, "getClientRects")
})

async function mountActualOptions(config: Config, location: string) {
  await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, config)
  const atomStore = createStore()
  atomStore.set(configAtom, config)
  activeRouter = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <SidebarProvider>
            <ThemeProvider forcedTheme="light">
              <TooltipProvider>
                <ToastProvider>
                  <AnchoredToastProvider>
                    <RecoveryBoundary>
                      <ScrollRestoration />
                      <AutosaveNavigation />
                      <AppShell>
                        <App />
                      </AppShell>
                      <SettingsSearch />
                    </RecoveryBoundary>
                  </AnchoredToastProvider>
                </ToastProvider>
              </TooltipProvider>
            </ThemeProvider>
          </SidebarProvider>
        ),
      },
    ],
    { initialEntries: [location] },
  )
  const rendered = render(
    <Provider store={atomStore}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={activeRouter} />
      </QueryClientProvider>
    </Provider>,
  )
  return { ...rendered, atomStore }
}

async function expectCompletedRoute(
  container: HTMLElement,
  location: string,
  heading: string,
  selector: string,
) {
  await waitFor(
    () => {
      if (screen.queryByText("errorRecovery.title")) {
        throw new Error(`Product recovery screen on ${location}: ${container.textContent}`)
      }
      const title = screen.getByRole("heading", { level: 1 })
      expect(title).toHaveTextContent(heading)
      const page = title.closest("header")!.parentElement!
      expect(page.querySelector(selector), `page-owned control ${selector}`).not.toBeNull()
      expect(
        page.querySelector("button,input,textarea,[role=combobox],a[href]"),
        "completed page must contain an actual control",
      ).not.toBeNull()
      expect(screen.queryByText("Loading settings…")).not.toBeInTheDocument()
      expect(screen.queryByText("options.preference.config.backup.loading")).not.toBeInTheDocument()
      const queries = queryClient.getQueryCache().getAll()
      const diagnostic = JSON.stringify(
        queries.map(({ queryKey, state }) => ({
          queryKey,
          status: state.status,
          fetchStatus: state.fetchStatus,
          error: String(state.error),
          failureReason: String(state.fetchFailureReason),
        })),
      )
      expect(queryClient.isFetching(), `page queries must settle: ${diagnostic}`).toBe(0)
      expect(
        queries.filter(({ state }) => state.status === "error"),
        `page queries must not fail: ${diagnostic}`,
      ).toHaveLength(0)
    },
    { timeout: 5000 },
  )
  expect(network).not.toHaveBeenCalled()
}

async function makeOwnProviderFixture() {
  const config = makeRouteSmokeConfig(true)
  const provider = buildRenyimiaoProvider(
    "Route-Smoke-Model",
    "synthetic-key-not-a-secret",
    "https://route-smoke.invalid/v1",
  )
  config.providersConfig.push(provider)
  const action = {
    ...getBuiltInAction(config.selectionToolbar, BUILT_IN_DICTIONARY_ACTION_ID),
    id: "route-smoke-action",
    name: "Route smoke custom action",
    enabled: true,
    providerId: provider.id,
  }
  config.selectionToolbar.customActions.push(action)
  await saveForkSession({
    loginCredential: "synthetic-credential-not-a-secret",
    phone: "",
    email: "route-smoke@example.invalid",
    user: {},
  })
  return { config, provider, action }
}

function collectOpenShadowRoots(root: ParentNode): ShadowRoot[] {
  const found: ShadowRoot[] = []
  for (const element of root.querySelectorAll("*")) {
    if (element.shadowRoot) {
      found.push(element.shadowRoot, ...collectOpenShadowRoots(element.shadowRoot))
    }
  }
  return found
}

describe("actual fork options route integration", () => {
  it("keeps the smoke matrix in step with every production route definition", () => {
    expect(ROUTE_EXPECTATIONS.map(([path]) => path)).toEqual(ROUTE_DEFS.map(({ path }) => path))
    expect(ROUTE_EXPECTATIONS).toHaveLength(29)
  })

  describe.each([false, true])(
    "legacy cloud overrides=%s (false is untouched DEFAULT_CONFIG)",
    (legacyCloudEnabled) => {
      it.each(ROUTE_EXPECTATIONS)(
        "completes %s without the recovery screen",
        async (path, heading, selector) => {
          const config = makeRouteSmokeConfig(legacyCloudEnabled)
          const location = path.replace(":glossaryId", SMOKE_GLOSSARY_ID)
          const { container, atomStore } = await mountActualOptions(config, location)
          await expectCompletedRoute(container, location, heading, selector)

          const main = container.querySelector("main")!
          const isGlossaryRoute = path === "/advanced" || path.startsWith("/advanced/glossary")
          expect(within(main).queryAllByText(SMOKE_GLOSSARY_NAME).length > 0).toBe(isGlossaryRoute)
          expect(activeRouter!.state.location.pathname).toBe(
            path === "/advanced" ? "/advanced/glossary" : location,
          )
          expect(screen.queryByText("errorRecovery.title")).not.toBeInTheDocument()
          expect(network).not.toHaveBeenCalled()
          expect(atomStore.get(configAtom).selectionToolbar.noteSuggestion.enabled).toBe(
            config.selectionToolbar.noteSuggestion.enabled,
          )
        },
      )
    },
  )

  it("completes API providers with a synthetic own-provider session and a saved custom action", async () => {
    const { config, provider } = await makeOwnProviderFixture()
    const { container } = await mountActualOptions(config, "/api-providers")
    await expectCompletedRoute(
      container,
      "/api-providers",
      "options.apiProviders.title",
      "#provider-config",
    )
    const section = container.querySelector<HTMLElement>("#provider-config")!
    await waitFor(() =>
      expect(within(section).getAllByText("Route-Smoke-Model").length).toBeGreaterThan(0),
    )
    expect(section.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe(
      provider.apiKey,
    )
    expect(network).not.toHaveBeenCalled()
  })

  it("completes a saved custom action's forbidden notebase deep link with its real editable local config", async () => {
    const { config, action } = await makeOwnProviderFixture()
    const location = `/custom-actions?actionId=${action.id}&tab=notebase`
    const { container } = await mountActualOptions(config, location)
    await expectCompletedRoute(
      container,
      location,
      "options.selectionToolbar.customActions.title",
      "#custom-actions",
    )
    await waitFor(() => expect(screen.getByDisplayValue(action.name)).toBeInTheDocument())
    expect(screen.getByRole("switch", { name: action.name })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    expect(container.querySelector(`#${CUSTOM_ACTION_NOTEBASE_SECTION_ID}`)).toBeNull()
    expect(screen.queryByText("Upstream cloud services are disabled.")).not.toBeInTheDocument()
    expect(network).not.toHaveBeenCalled()
  })

  it("opens and closes the real custom layout editor and preview without changing the saved action", async () => {
    const { config, action } = await makeOwnProviderFixture()
    const location = `/custom-actions?actionId=${action.id}`
    const { container, atomStore } = await mountActualOptions(config, location)
    await expectCompletedRoute(
      container,
      location,
      "options.selectionToolbar.customActions.title",
      "#custom-actions",
    )
    await waitFor(() => expect(screen.getByDisplayValue(action.name)).toBeInTheDocument())
    const previous = structuredClone(atomStore.get(configAtom).selectionToolbar.customActions)
    fireEvent.click(
      screen.getByRole("button", {
        name: "options.selectionToolbar.customActions.form.layout.edit",
      }),
    )
    const dialog = await screen.findByRole("dialog", {
      name: "options.selectionToolbar.customActions.form.layout.title",
    })
    await waitFor(() => {
      expect(dialog).toHaveAttribute("data-custom-action-layout-editor", "")
      expect(dialog.querySelector(".cm-editor .cm-content")).not.toBeNull()
      expect(collectOpenShadowRoots(dialog).length).toBeGreaterThanOrEqual(2)
      expect(
        within(dialog).getByRole("button", {
          name: "options.selectionToolbar.customActions.form.layout.sampleData",
        }),
      ).toBeInTheDocument()
    })
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByDisplayValue(action.name)).toBeInTheDocument()
    expect(atomStore.get(configAtom).selectionToolbar.customActions).toEqual(previous)
    expect(screen.queryByText("errorRecovery.title")).not.toBeInTheDocument()
    expect(network).not.toHaveBeenCalled()
  })
})
