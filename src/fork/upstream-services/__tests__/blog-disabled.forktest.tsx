import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { WhatsNewFooter } from "@/entrypoints/options/app-sidebar/whats-new-footer"
import BlogNotification from "@/fork/ui/popup/blog-notification"
import { getLatestBlogDate, resolveBlogLocale } from "@/utils/blog"
import { sendMessage } from "@/utils/message"

vi.mock("@/utils/message", () => ({
  sendMessage: vi
    .fn<() => Promise<never>>()
    .mockRejectedValue(new Error("Unexpected blog request")),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("disabled blog", () => {
  it("returns null without requesting either upstream or a fork domain", async () => {
    expect(await getLatestBlogDate()).toBeNull()
    expect(
      await getLatestBlogDate("https://example.test/api/blog/latest", "en", "1.3.0", false),
    ).toBeNull()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(resolveBlogLocale("zh-Hant")).toBe("zh-TW")
  })

  it("mounts no notification or queries even with old blog query data", () => {
    vi.spyOn(fakeBrowser.i18n, "getUILanguage").mockReturnValue("en")
    const client = new QueryClient()
    client.setQueryData(["latest-blog-post", "en"], {
      date: new Date(),
      url: "/blog/old",
      title: "Old update",
    })
    const before = client.getQueryCache().getAll().length
    const { container } = render(
      <QueryClientProvider client={client}>
        <BlogNotification />
        <WhatsNewFooter />
      </QueryClientProvider>,
    )
    expect(container).toBeEmptyDOMElement()
    expect(client.getQueryCache().getAll()).toHaveLength(before)
    expect(sendMessage).not.toHaveBeenCalled()
    client.clear()
  })
})
