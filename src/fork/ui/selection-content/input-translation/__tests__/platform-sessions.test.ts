// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { captureInputPlatformSession } from "../platforms"

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ""
})

describe("input context ownership", () => {
  // Local contract fixtures; live selector coverage is a separate acceptance step.
  it.each([
    [
      "https://discord.com/channels/1/2",
      '<main><li id="chat-messages-1"><div id="message-content-1">Scoped context</div></li><textarea></textarea></main>',
    ],
    [
      "https://web.telegram.org/a/#123",
      '<div class="MiddleColumn"><div class="MessageList" data-list-key="123"><div class="Message" data-message-id="1"><div class="text-content">Scoped context</div></div><div class="list-bottom-marker"></div></div><div id="editable-message-text" contenteditable="true"></div></div>',
    ],
    [
      "https://www.youtube.com/watch?v=1",
      '<ytd-comment-thread-renderer><ytd-comment-view-model><div id="content-text">Scoped context</div></ytd-comment-view-model><textarea></textarea></ytd-comment-thread-renderer>',
    ],
    [
      "https://www.youtube.com/live_chat?v=1",
      '<yt-live-chat-app><yt-live-chat-text-message-renderer><span id="message">Scoped context</span></yt-live-chat-text-message-renderer><textarea></textarea></yt-live-chat-app>',
    ],
    [
      "https://x.com/u/status/1",
      '<div role="dialog"><div data-testid="tweetText">Scoped context</div><textarea></textarea></div>',
    ],
    [
      "https://x.com/compose/post",
      '<form><div data-testid="tweetText">Scoped context</div><textarea></textarea></form>',
    ],
    [
      "https://x.com/messages/1",
      '<div data-testid="conversation"><div data-testid="messageEntry">Scoped context</div><textarea></textarea></div>',
    ],
    [
      "https://web.whatsapp.com/",
      '<div id="main"><header><span title="contact"></span></header><div data-id="false_123@c.us_1"><div class="selectable-text">Scoped context</div></div><footer><textarea></textarea></footer></div>',
    ],
    [
      "https://www.reddit.com/r/test/comments/1",
      '<shreddit-comment thingid="c1"><div slot="comment">Scoped context</div><textarea></textarea></shreddit-comment>',
    ],
    [
      "https://www.reddit.com/r/test/submit",
      '<shreddit-post id="post"><shreddit-post-text-body>Scoped context</shreddit-post-text-body><textarea></textarea></shreddit-post>',
    ],
  ])("extracts only editor-owned messages on %s and invalidates navigation", (url, html) => {
    vi.stubGlobal("location", new URL(url))
    document.body.innerHTML = `<aside>Unrelated conversation</aside>${html}`
    const editor = document.querySelector<HTMLElement>('textarea, [contenteditable="true"]')!
    const session = captureInputPlatformSession(editor)!
    expect(session.readContext()).toEqual({ webContent: "Scoped context" })
    const sibling = document.createElement("section")
    sibling.innerHTML = html.replace("Scoped context", "Another editor's context")
    document.body.append(sibling)
    expect(session.readContext()).toEqual({ webContent: "Scoped context" })
    vi.stubGlobal("location", new URL(`${url}#another`))
    expect(session.isCurrent()).toBe(false)
    expect(session.readContext()).toBeUndefined()
    vi.stubGlobal("location", new URL(url))
    editor.remove()
    expect(session.isCurrent()).toBe(false)
  })

  it("invalidates the same WhatsApp editor when the peer changes", () => {
    vi.stubGlobal("location", new URL("https://web.whatsapp.com/"))
    document.body.innerHTML =
      '<div id="main"><div data-id="false_123@c.us_1"></div><footer><textarea></textarea></footer></div>'
    const session = captureInputPlatformSession(document.querySelector("textarea")!)!
    document.querySelector("[data-id]")!.setAttribute("data-id", "false_456@c.us_2")
    expect(session.isCurrent()).toBe(false)
  })
})
