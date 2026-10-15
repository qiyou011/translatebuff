import type {
  requestVideoSummary as UpstreamRequest,
  VideoSummaryAvailability,
} from "@/utils/subtitles/video-summary"
import { UpstreamCloudDisabledError } from "./disabled-error"

export * from "@/utils/subtitles/video-summary"

export async function checkVideoSummaryAvailability(): Promise<VideoSummaryAvailability> {
  return { status: "hostedUnavailable", message: new UpstreamCloudDisabledError().message }
}

export async function requestVideoSummary(
  ..._args: Parameters<typeof UpstreamRequest>
): ReturnType<typeof UpstreamRequest> {
  throw new UpstreamCloudDisabledError()
}
