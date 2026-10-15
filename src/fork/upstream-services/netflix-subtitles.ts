import { NetflixSubtitlesFetcher as UpstreamFetcher } from "@/utils/subtitles/fetchers/netflix"
import { UpstreamCloudDisabledError } from "./disabled-error"

export * from "@/utils/subtitles/fetchers/netflix"

export class NetflixSubtitlesFetcher extends UpstreamFetcher {
  override async fetch(): ReturnType<UpstreamFetcher["fetch"]> {
    throw new UpstreamCloudDisabledError()
  }

  override async hasAvailableSubtitles(): Promise<boolean> {
    return false
  }

  override async shouldUseSameTrack(): Promise<boolean> {
    return false
  }

  override cleanup(): void {}
}
