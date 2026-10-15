// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, cleanup, renderHook } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, expect, it, vi } from "vitest"
import {
  createSelectionSession,
  selectionSessionAtom,
} from "@/entrypoints/selection.content/selection-toolbar/atoms"
import { buildContextSnapshot, readSelectionSnapshot } from "@/entrypoints/selection.content/utils"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { useSelectionCustomActionController } from "../use-custom-action-controller"

vi.mock("@/entrypoints/selection.content", () => ({ shadowWrapper: null }))
vi.mock("@/components/custom-action/use-custom-action-execution", () => ({
  useCustomActionWebPageContext: () => ({ webTitle: "Page" }),
  buildCustomActionExecutionPlan: () => ({ executionContext: null, error: null }),
  useCustomActionExecution: () => ({
    error: null,
    isRunning: false,
    result: null,
    thinking: null,
    resetSessionState: vi.fn<() => void>(),
  }),
}))
function setup() {
  const control = document.createElement("textarea")
  control.value = "Private surrounding paragraph with Selected words."
  document.body.append(control)
  control.focus()
  const start = control.value.indexOf("Selected")
  control.setSelectionRange(start, start + 8)
  const range = document.createRange()
  range.selectNode(control)
  const selection = {
    toString: () => "Selected",
    rangeCount: 1,
    getRangeAt: () => range,
  } as unknown as Selection
  const reads = vi.spyOn(control, "value", "get")
  const snapshot = readSelectionSnapshot(selection)
  const store = createStore()
  store.set(configAtom, DEFAULT_CONFIG)
  store.set(selectionSessionAtom, createSelectionSession(snapshot, buildContextSnapshot(snapshot)))
  const hook = renderHook(() => useSelectionCustomActionController(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    ),
  })
  // Supply the public popover command surface just as SelectionPopover.Root does.
  hook.result.current.popoverActionsRef.current = {
    requestOpen: () => hook.result.current.handleOpenChange(true),
  }
  const trigger = document.createElement("button")
  document.body.append(trigger)
  return { hook, control, reads, trigger }
}
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

it("captures current input context once at the actual approved fork action boundary; close does not reread it", () => {
  const { hook, reads, trigger } = setup()
  expect(reads).not.toHaveBeenCalled()
  act(() => hook.result.current.openToolbarCustomAction("default-dictionary", trigger))
  expect(hook.result.current.paragraphsText).toBe(
    "Private surrounding paragraph with Selected words.",
  )
  expect(reads).toHaveBeenCalledTimes(1)
  act(() => hook.result.current.handleOpenChange(false))
  expect(reads).toHaveBeenCalledTimes(1)
})
it("does not collect a context for unavailable action ids or a field made sensitive after selection", () => {
  const { hook, control, reads, trigger } = setup()
  act(() => hook.result.current.openToolbarCustomAction("unapproved-action", trigger))
  expect(reads).not.toHaveBeenCalled()
  control.setAttribute("autocomplete", "one-time-code")
  act(() => hook.result.current.openToolbarCustomAction("default-dictionary", trigger))
  expect(hook.result.current.paragraphsText).toBe("Selected")
  expect(reads).not.toHaveBeenCalled()
})
