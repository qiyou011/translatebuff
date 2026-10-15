// @vitest-environment jsdom
import type { SelectionSnapshot } from "@/entrypoints/selection.content/utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildContextSnapshot,
  captureSelectionActionContext,
  createRangeSnapshot,
  readSelectionSnapshot,
} from "@/entrypoints/selection.content/utils"

function setupControl(
  tag: "input" | "textarea" = "input",
  attributes: Record<string, string | undefined> = {},
) {
  const control = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined) control.setAttribute(name, value)
  }
  const value = "First paragraph.\n\nSelected words inside this paragraph.\n\nFinal paragraph."
  control.value = value
  document.body.append(control)
  control.focus()
  const start = value.indexOf("Selected words")
  try {
    control.setSelectionRange(start, start + 14)
  } catch {
    /* Unsupported selection API. */
  }
  const valueGetter = vi.spyOn(control, "value", "get")
  const range = document.createRange()
  range.selectNode(control)
  const selection = {
    toString: () => "Selected words",
    rangeCount: 1,
    getRangeAt: () => range,
    anchorNode: range.startContainer,
    focusNode: range.endContainer,
  } as unknown as Selection
  return { control, valueGetter, selection, range }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
  document.head.innerHTML = ""
})

describe("selection input context privacy", () => {
  it("does not read complete value when recording/displaying/cancelling a selection", () => {
    const { selection, valueGetter } = setupControl("textarea")
    let snapshot = readSelectionSnapshot(selection)
    expect(snapshot?.text).toBe("Selected words")
    expect(valueGetter).not.toHaveBeenCalled()
    expect(buildContextSnapshot(snapshot)?.text).toBe("Selected words")
    expect(valueGetter).not.toHaveBeenCalled()
    snapshot = null
    expect(buildContextSnapshot(snapshot)).toBeNull()
    expect(valueGetter).not.toHaveBeenCalled()
  })

  it.each(["text", "search", ""])(
    'reads the current value only at an explicit action for input type "%s"',
    (type) => {
      const { control, selection, valueGetter } = setupControl("input", type ? { type } : {})
      const snapshot = readSelectionSnapshot(selection)
      control.value = "Before. Selected words after."
      control.setSelectionRange(8, 22)
      // The selection may move between display and the action; collect its current paragraph.
      expect(captureSelectionActionContext(snapshot)?.text).toBe("Before. Selected words after.")
      expect(valueGetter).toHaveBeenCalledTimes(1)
    },
  )

  it("only passes overlapping textarea paragraphs to the action", () => {
    const { selection, valueGetter } = setupControl("textarea")
    const snapshot = readSelectionSnapshot(selection)
    expect(captureSelectionActionContext(snapshot)).toEqual({
      text: "Selected words inside this paragraph.",
      paragraphs: ["Selected words inside this paragraph."],
    })
    expect(valueGetter).toHaveBeenCalledTimes(1)
    expect(buildContextSnapshot(snapshot)?.text).toBe("Selected words")
    expect(valueGetter).toHaveBeenCalledTimes(1)
  })

  it.each([
    { type: "email" },
    { type: "tel" },
    { type: "password" },
    { type: "url" },
    { name: "verificationCode" },
    { autocomplete: "one-time-code" },
    { autocomplete: "cc-number" },
    { name: "credit_card" },
    { id: "userPassword" },
    { "aria-label": "验证码" },
    { placeholder: "请输入银行卡号" },
    { name: "phone" },
  ])("never reads sensitive fields %j, even through direct action capture", (attributes) => {
    const { control, selection, range, valueGetter } = setupControl("input", attributes)
    const snapshot = readSelectionSnapshot(selection)
    buildContextSnapshot(snapshot)
    captureSelectionActionContext(snapshot)
    const direct = {
      text: "Selected words",
      ranges: [createRangeSnapshot(range)],
      textControl: { element: control, selectionStart: 18, selectionEnd: 32 },
    } as SelectionSnapshot
    captureSelectionActionContext(direct)
    expect(valueGetter).not.toHaveBeenCalled()
  })

  it.each(["document", "shadow", "nested-shadow"])(
    "resolves sensitive aria-labelledby in the control's own %s tree without reading value",
    (tree) => {
      const { control, selection, range, valueGetter } = setupControl("input", {
        "aria-labelledby": "missing-label field-label",
      })
      const label = document.createElement("span")
      label.id = "field-label"
      label.textContent = "Verification code"
      if (tree !== "document") {
        const outsideLabel = document.createElement("span")
        outsideLabel.id = "field-label"
        outsideLabel.textContent = "Message"
        document.body.append(outsideLabel)
        const host = document.createElement("div")
        document.body.append(host)
        let root = host.attachShadow({ mode: "open" })
        if (tree === "nested-shadow") {
          const nestedHost = document.createElement("div")
          root.append(nestedHost)
          root = nestedHost.attachShadow({ mode: "open" })
        }
        root.append(label, control)
        control.focus()
        range.selectNode(control)
      } else {
        document.body.append(label)
      }

      const snapshot = readSelectionSnapshot(selection)
      const context = captureSelectionActionContext(snapshot)
      expect(valueGetter).not.toHaveBeenCalled()
      expect(context?.text).toBe("Selected words")
    },
  )

  it.each(["detached", "type", "autocomplete", "name"])(
    'rechecks control safety at the action boundary after "%s" changes',
    (change) => {
      const { control, selection, valueGetter } = setupControl()
      const snapshot = readSelectionSnapshot(selection)
      if (change === "detached") control.remove()
      else control.setAttribute(change, change === "type" ? "password" : "one-time-code")
      captureSelectionActionContext(snapshot)
      expect(valueGetter).not.toHaveBeenCalled()
    },
  )

  it.each(["style", "script", "noscript", "title"])(
    "never treats directly selected %s contents as action context",
    (tag) => {
      const node = document.createElement(tag)
      if (tag === "script") node.setAttribute("type", "application/json")
      node.textContent =
        tag === "style" ? ":root { --secret: Hidden; }" : "Hidden secret outside page body"
      document.body.append(node)
      const range = document.createRange()
      range.selectNodeContents(node)
      const snapshot = { text: "secret", ranges: [createRangeSnapshot(range)] }
      expect(buildContextSnapshot(snapshot)).toBeNull()
      expect(captureSelectionActionContext(snapshot)).toBeNull()
    },
  )
})
