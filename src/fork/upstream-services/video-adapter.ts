import { UniversalVideoAdapter as UpstreamAdapter } from "@/entrypoints/subtitles.content/universal-adapter"
import { UpstreamCloudDisabledError } from "./disabled-error"

export * from "@/entrypoints/subtitles.content/universal-adapter"

export class UniversalVideoAdapter extends UpstreamAdapter {
  override get supportsSidebar(): boolean {
    return false
  }

  override get supportsAiSubtitles(): boolean {
    return false
  }

  override generateVideoSummary: UpstreamAdapter["generateVideoSummary"] = async () => {
    throw new UpstreamCloudDisabledError()
  }

  override requestAiSubtitles: UpstreamAdapter["requestAiSubtitles"] = async () => {
    throw new UpstreamCloudDisabledError()
  }
}
