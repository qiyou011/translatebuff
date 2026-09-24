// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { canReplaceTelegramDraft, replaceText } from "../replace-text"

describe("contenteditable replacement", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("notifies a host editor when execCommand changes text without an input event", () => {
    const editor = document.createElement("div")
    editor.contentEditable = "true"
    editor.tabIndex = 0
    Object.defineProperty(editor, "isContentEditable", { value: true })
    editor.textContent = "draft"
    document.body.append(editor)
    editor.focus()
    document.execCommand = vi.fn<(command: string, show?: boolean, value?: string) => boolean>(
      (command, _show, value) => {
        if (command === "insertText") editor.textContent = value ?? ""
        return true
      },
    )
    const onInput = vi.fn<() => void>()
    editor.addEventListener("input", onInput)

    expect(replaceText("translated", true)).toBe(true)
    expect(editor.textContent).toBe("translated")
    expect(onInput).toHaveBeenCalledTimes(1)
  })

  it("rejects a queued write after a same-text edit changes the draft version", () => {
    document.body.innerHTML = `<div class="MiddleColumn"><div class="MessageList" data-list-key="one"></div><div id="editable-message-text" contenteditable="true">draft</div></div>`
    const editor = document.querySelector<HTMLElement>("#editable-message-text")!
    Object.defineProperty(editor, "isContentEditable", { value: true })
    editor.tabIndex = 0
    editor.focus()
    editor.setAttribute("data-read-frog-input-version", "1")
    const expected = {
      sessionKey: "a:one:#1",
      expectedUrl: "https://web.telegram.org/a/#1",
      expectedText: "draft",
      expectedVersion: "1",
    }
    vi.stubGlobal("location", new URL("https://web.telegram.org/a/#1"))
    expect(canReplaceTelegramDraft(expected, editor)).toBe(true)
    editor.setAttribute("data-read-frog-input-version", "2")
    expect(canReplaceTelegramDraft(expected, editor)).toBe(false)
  })
})
