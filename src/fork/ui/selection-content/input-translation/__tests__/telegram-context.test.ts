// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"
import { getTelegramContext, getTelegramSessionKey } from "../telegram-context"

describe("Telegram chat context", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("takes only Web A messages from the editor's current chat and drops duplicate markers and noise", () => {
    document.body.innerHTML = `
      <div class="MiddleColumn"><div class="MessageList" data-list-key="old"><div class="Message" data-message-id="1"><div class="text-content">안녕</div></div></div></div>
      <div class="MiddleColumn"><div class="MessageList" data-list-key="current">
        <div class="Message" data-message-id="2"><div class="text-content">こんにちは<span class="MessageMeta">12:00</span></div></div>
        <div class="bottom-marker" data-message-id="2"></div><div class="list-bottom-marker"></div>
      </div><div class="Composer"><div id="editable-message-text" contenteditable="true"></div></div></div>`
    const editor = document.querySelector<HTMLElement>("#editable-message-text")!
    const context = getTelegramContext("https://web.telegram.org/a/#123", editor)
    expect(context?.key).toBe("a:current:#123")
    expect(context?.messages.map((message) => message.textContent)).toEqual(["こんにちは"])
    editor
      .closest(".Composer")!
      .insertAdjacentHTML("beforeend", `<button class="main-button edit"></button>`)
    expect(getTelegramSessionKey("https://web.telegram.org/a/#123", editor)).toBeNull()
  })

  it("takes only Web K active peer messages and ignores the fake input", () => {
    document.body.innerHTML = `
      <div class="chat active"><div class="bubbles scrolled-down"><div class="bubbles-scrollable"><div class="bubbles-inner"><div class="bubble" data-mid="1" data-peer-id="42"><div class="message spoilers-container">안녕</div></div></div></div></div>
      <div class="chat-input"><div class="input-message-input" contenteditable="true">draft</div><div class="input-message-input input-field-input-fake" contenteditable="true"></div></div></div>`
    const editor = document.querySelector<HTMLElement>(".input-message-input")!
    expect(getTelegramContext("https://web.telegram.org/k/#42", editor)?.key).toMatch(/^k:42:#42:/)
    expect(
      getTelegramContext(
        "https://web.telegram.org/k/#42",
        document.querySelector<HTMLElement>(".input-field-input-fake")!,
      ),
    ).toBeNull()
    const previous = getTelegramSessionKey("https://web.telegram.org/k/#42", editor)
    document.querySelector(".bubbles-inner")!.replaceWith(document.createElement("div"))
    const replacement = document.querySelector(".bubbles-scrollable > div")!
    replacement.className = "bubbles-inner"
    replacement.innerHTML = `<div class="bubble" data-mid="1" data-peer-id="42"><div class="message spoilers-container">안녕</div></div>`
    expect(getTelegramSessionKey("https://web.telegram.org/k/#42", editor)).not.toBe(previous)
    editor
      .closest(".chat-input")!
      .insertAdjacentHTML("beforeend", `<button class="btn-send edit"></button>`)
    expect(getTelegramSessionKey("https://web.telegram.org/k/#42", editor)).toBeNull()
  })

  it("fails closed when the current chat or latest message window cannot be identified", () => {
    document.body.innerHTML = `<div class="MiddleColumn"><div class="MessageList" data-list-key="old"><div class="Message" data-message-id="1"><div class="text-content">old</div></div></div><div id="editable-message-text" contenteditable="true"></div></div>`
    expect(
      getTelegramContext(
        "https://web.telegram.org/a/#123",
        document.querySelector<HTMLElement>("#editable-message-text")!,
      ),
    ).toBeNull()
  })

  it("keeps a Web K empty chat eligible for draft translation without guessing its language", () => {
    document.body.innerHTML = `<div class="chat active"><div class="bubbles scrolled-down"><div class="bubbles-scrollable"><div class="bubbles-inner"></div></div></div><div class="chat-input"><div class="input-message-input" contenteditable="true">draft</div></div></div>`
    const editor = document.querySelector<HTMLElement>(".input-message-input")!
    expect(getTelegramSessionKey("https://web.telegram.org/k/#42", editor)).toMatch(/^k:empty:#42:/)
    expect(getTelegramContext("https://web.telegram.org/k/#42", editor)?.messages).toEqual([])
  })
})
