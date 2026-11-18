// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import ForkProviderSelector from "../provider-selector"
vi.mock("@/components/providers/theme-provider", () => ({ useTheme: () => ({ theme: "light" }) }))
afterEach(cleanup)
it("disables the selector and explains an empty allowed directory", () => {
  render(<ForkProviderSelector providers={[]} value="removed" onChange={() => {}} />)
  expect(screen.getByRole("combobox")).toBeDisabled()
  expect(screen.getByRole("combobox")).toHaveTextContent("forkProviders.noServices")
})
it("explains an unavailable selection while keeping alternatives selectable", () => {
  render(
    <ForkProviderSelector
      providers={[{ id: "google", name: "Google", provider: "google-translate", enabled: true }]}
      value="removed"
      onChange={() => {}}
    />,
  )
  expect(screen.getByRole("combobox")).not.toBeDisabled()
  expect(screen.getByRole("combobox")).toHaveTextContent("forkProviders.unavailable")
})
