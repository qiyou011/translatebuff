import type { requestAiSubtitles as UpstreamRequest } from "@/utils/subtitles/ai/request-ai-subtitles"
import { UpstreamCloudDisabledError } from "./disabled-error"

export type { AiSubtitlesContext } from "@/utils/subtitles/ai/request-ai-subtitles"

export async function requestAiSubtitles(
  ..._args: Parameters<typeof UpstreamRequest>
): ReturnType<typeof UpstreamRequest> {
  throw new UpstreamCloudDisabledError()
}
