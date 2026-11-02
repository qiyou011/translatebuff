// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

afterEach(cleanup)

it("renders one toast when the separate content bundles each have their own manager", async () => {
  // Current WXT artifacts are separate IIFEs. Query IDs model the three module
  // instances while keeping React shared with the renderer in this test.
  type ToastModule = typeof import("@/components/ui/base-ui/toast")
  const host = await vi.importActual<ToastModule>("@/components/ui/base-ui/toast?surface=host")
  const selection = await vi.importActual<ToastModule>(
    "@/components/ui/base-ui/toast?surface=selection",
  )
  const side = await vi.importActual<ToastModule>("@/components/ui/base-ui/toast?surface=side")
  expect(host.toastManager).not.toBe(selection.toastManager)
  expect(selection.toastManager).not.toBe(side.toastManager)
  render(
    <>
      <host.ToastProvider />
      <selection.ToastProvider />
      <side.ToastProvider />
    </>,
  )
  act(() => {
    host.toastManager.add({ title: "one-page-toast" })
  })
  expect(await screen.findAllByText("one-page-toast")).toHaveLength(1)
})
