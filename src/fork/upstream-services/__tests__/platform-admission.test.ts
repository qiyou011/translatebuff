// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { subtitlesContentScriptMatches } from "@/entrypoints/subtitles.content/content-script-matches"
import { bootstrapSubtitlesRuntime } from "@/entrypoints/subtitles.content/runtime"

const { youtube, xcom, netflix } = vi.hoisted(() => ({
  youtube: vi.fn<(...args: unknown[]) => void>(),
  xcom: vi.fn<(...args: unknown[]) => void>(),
  netflix: vi.fn<(...args: unknown[]) => void>(),
}))
vi.mock("@/entrypoints/subtitles.content/init-youtube-subtitles", () => ({
  initYoutubeSubtitles: youtube,
}))
vi.mock("@/entrypoints/subtitles.content/init-xcom-subtitles", () => ({ initXcomSubtitles: xcom }))
vi.mock("@/entrypoints/subtitles.content/init-netflix-subtitles", () => ({
  initNetflixSubtitles: netflix,
}))

beforeEach(() => vi.clearAllMocks())

describe("subtitle platform admission", () => {
  it("does not register X or Netflix auto-injection patterns", () => {
    expect(
      subtitlesContentScriptMatches.some((pattern) => /x\.com|twitter|netflix/.test(pattern)),
    ).toBe(false)
    expect(subtitlesContentScriptMatches.some((pattern) => pattern.includes("youtube.com"))).toBe(
      true,
    )
  })

  it("starts native YouTube without initializing the unapproved platform runtimes", () => {
    bootstrapSubtitlesRuntime({} as never)
    expect(youtube).toHaveBeenCalledOnce()
    expect(xcom).not.toHaveBeenCalled()
    expect(netflix).not.toHaveBeenCalled()
  })
})
