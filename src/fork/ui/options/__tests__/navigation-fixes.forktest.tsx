// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { SidebarProvider } from "@/components/ui/base-ui/sidebar"
import { FeaturesNav } from "@/entrypoints/options/app-sidebar/features-nav"
import { ShortcutLink } from "@/entrypoints/options/components/shortcut-link"
import { GetAPIKeyButton } from "@/entrypoints/options/pages/api-providers/providers-config/provider-config-form/components/get-api-key-button"

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))

let router: ReturnType<typeof createMemoryRouter> | undefined

beforeEach(() => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
})

afterEach(() => {
  cleanup()
  router?.dispose()
  router = undefined
  vi.unstubAllGlobals()
})

it.each([
  ["options.sidebar.translation", "/page-translation/prompts"],
  ["options.overlayTools.title", "/floating-button"],
  ["options.advanced.title", "/advanced/glossary/example"],
])("opens %s on route entry and preserves manual closing", async (name, path) => {
  router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <SidebarProvider>
            <FeaturesNav />
          </SidebarProvider>
        ),
      },
    ],
    { initialEntries: ["/custom-actions"] },
  )
  render(<RouterProvider router={router} />)
  const trigger = screen.getByRole("button", { name })
  expect(trigger).toHaveAttribute("aria-expanded", "false")
  await act(() => router!.navigate(path))
  expect(trigger).toHaveAttribute("aria-expanded", "true")
  fireEvent.click(trigger)
  expect(trigger).toHaveAttribute("aria-expanded", "false")
  await act(() => router!.navigate("/preference"))
  await act(() => router!.navigate(path))
  expect(trigger).toHaveAttribute("aria-expanded", "true")
})

it("keeps shortcut navigation a native link with its section target", () => {
  router = createMemoryRouter([
    { path: "*", element: <ShortcutLink sectionId="subtitles-toggle-shortcut" /> },
  ])
  render(<RouterProvider router={router} />)
  const link = screen.getByRole("link", { name: "options.shortcuts.setShortcut" })
  expect(link).toHaveAttribute("href", "/shortcuts?section=subtitles-toggle-shortcut")
  expect(link).not.toHaveAttribute("type")
})

it("opens the existing provider key URL as a native external link", () => {
  render(<GetAPIKeyButton providerType="atlascloud" />)
  const link = screen.getByRole("link", { name: "options.apiProviders.apiKey.getAPIKey" })
  expect(link.getAttribute("href")).toMatch(/^https:\/\//)
  expect(link).toHaveAttribute("target", "_blank")
  expect(link).not.toHaveAttribute("type")
})
