// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { admission, setupTtmlCapture, listenForSubtitlesRequests } = vi.hoisted(() => ({
  admission: { netflixSubtitles: true },
  setupTtmlCapture: vi.fn<() => void>(),
  listenForSubtitlesRequests: vi.fn<() => void>(),
}))

vi.mock("@/fork/upstream-admission", () => ({ FORK_UPSTREAM_ADMISSION: admission }))
vi.mock("../ttml-capture", () => ({ setupTtmlCapture }))
vi.mock("../player", () => ({ listenForSubtitlesRequests }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  admission.netflixSubtitles = true
})

afterEach(() => {
  Reflect.deleteProperty(window, "__READ_FROG_NETFLIX_INTERCEPTOR_INJECTED__")
})

describe("Netflix interceptor entrypoint", () => {
  it("omits optional exclusions when admitted so Firefox accepts the manifest", async () => {
    const { default: entrypoint } = await import("../index")

    expect(entrypoint.matches).toEqual(["*://www.netflix.com/*"])
    expect(entrypoint.excludeMatches).toBeUndefined()
    expect(entrypoint.world).toBe("MAIN")
    expect(entrypoint.runAt).toBe("document_start")
  })

  it("preserves the exclusion and runtime guard when admission is disabled", async () => {
    admission.netflixSubtitles = false
    const { default: entrypoint } = await import("../index")

    expect(entrypoint.excludeMatches).toEqual(["*://www.netflix.com/*"])
    entrypoint.main({} as never)
    expect(setupTtmlCapture).not.toHaveBeenCalled()
    expect(listenForSubtitlesRequests).not.toHaveBeenCalled()
  })

  it("still initializes subtitle capture once when admitted", async () => {
    const { default: entrypoint } = await import("../index")

    entrypoint.main({} as never)
    entrypoint.main({} as never)
    expect(setupTtmlCapture).toHaveBeenCalledOnce()
    expect(listenForSubtitlesRequests).toHaveBeenCalledOnce()
  })
})
