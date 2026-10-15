import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { requestAiSubtitles } from "../ai-subtitles"
import {
  ensureAiSubtitlesAccess,
  ensureAiSubtitlesEntitled,
  ensureSignedIn,
} from "../ai-subtitles-access"
import { requestVideoSummary } from "../learning-sidebar"

const { getSession, createTranscript, getUsage, streamText, sendMessage } = vi.hoisted(() => ({
  getSession: vi
    .fn<() => Promise<{ data: { user: { id: string } } }>>()
    .mockResolvedValue({ data: { user: { id: "legacy-user" } } }),
  createTranscript: vi
    .fn<() => Promise<never>>()
    .mockRejectedValue(new Error("Unexpected cloud request")),
  getUsage: vi
    .fn<() => Promise<{ plan: string; remainingMinutes: number }>>()
    .mockResolvedValue({ plan: "pro", remainingMinutes: 100 }),
  streamText: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  sendMessage: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null),
}))
vi.mock("@/utils/auth/auth-client", () => ({ authClient: { getSession } }))
vi.mock("@/utils/orpc/client", () => ({
  orpcClient: { videoTranscript: { create: createTranscript, getUsage } },
}))
vi.mock("@/utils/content-script/background-stream-client", () => ({
  streamBackgroundText: streamText,
}))
vi.mock("@/utils/message", () => ({ sendMessage }))

beforeEach(() => vi.clearAllMocks())

describe("new cloud and learning boundaries", () => {
  it("ends direct transcription before creating or polling a cloud job", async () => {
    await expect(
      requestAiSubtitles({
        videoId: "video",
        url: "https://youtube.com/watch?v=video",
        durationSec: 60,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_CLOUD_DISABLED", isRetryable: false })
    expect(createTranscript).not.toHaveBeenCalled()
  })

  it("does not initialize auth or entitlement queries even for an old signed-in user", async () => {
    expect(await ensureSignedIn()).toBe(false)
    expect(await ensureAiSubtitlesEntitled()).toBe(false)
    expect(await ensureAiSubtitlesAccess()).toBe(false)
    expect(getSession).not.toHaveBeenCalled()
    expect(getUsage).not.toHaveBeenCalled()
  })

  it("rejects direct learning summary generation before cache or model work", async () => {
    await expect(
      requestVideoSummary([{ text: "Transcript", start: 0, end: 1000 }], DEFAULT_CONFIG),
    ).rejects.toMatchObject({ code: "UPSTREAM_CLOUD_DISABLED", isRetryable: false })
    expect(sendMessage).not.toHaveBeenCalled()
    expect(streamText).not.toHaveBeenCalled()
  })
})
