// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { subtitlesContentScriptMatches } from "@/entrypoints/subtitles.content/content-script-matches"
import { bootstrapSubtitlesRuntime } from "@/entrypoints/subtitles.content/runtime"
import { isApprovedSubtitlesUrl, FORK_UPSTREAM_ADMISSION } from "@/fork/upstream-admission"

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
  it("registers all three approved native subtitle platforms", () => {
    for (const host of ["youtube.com", "x.com", "netflix.com"]) {
      expect(subtitlesContentScriptMatches.some((pattern) => pattern.includes(host))).toBe(true)
      expect(isApprovedSubtitlesUrl(`https://www.${host}/watch`)).toBe(true)
      expect(isApprovedSubtitlesUrl(`https://${host}.unrelated.test/watch`)).toBe(false)
    }
    expect(FORK_UPSTREAM_ADMISSION.aiTranscription).toBe(false)
  })

  it("initializes the three native platform runtimes", () => {
    bootstrapSubtitlesRuntime({} as never)
    expect(youtube).toHaveBeenCalledOnce()
    expect(xcom).toHaveBeenCalledOnce()
    expect(netflix).toHaveBeenCalledOnce()
  })
})
