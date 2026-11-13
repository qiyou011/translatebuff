import { UniversalVideoAdapter as UpstreamAdapter } from "@/entrypoints/subtitles.content/universal-adapter"
import { readFeatureConfig, subscribeFeatureConfig } from "@/fork/config/storage"
import { readSubtitleConfig, subtitleConfigIdentity } from "@/fork/config/subtitle-config"
import { UpstreamCloudDisabledError } from "./disabled-error"

export * from "@/entrypoints/subtitles.content/universal-adapter"

export class UniversalVideoAdapter extends UpstreamAdapter {
  private unsubscribeConfig?: () => void

  constructor(options: ConstructorParameters<typeof UpstreamAdapter>[0]) {
    super({ ...options, readTranslationConfig: readSubtitleConfig })
  }

  override async initialize() {
    let lastIdentity = subtitleConfigIdentity(await readFeatureConfig())
    this.unsubscribeConfig = subscribeFeatureConfig((pair) => {
      const identity = subtitleConfigIdentity(pair)
      if (lastIdentity !== identity) {
        this.handleTranslationConfigChanged(pair.mainConfig.videoSubtitles.enabled)
      }
      lastIdentity = identity
    })
    await super.initialize()
  }

  override destroy() {
    this.unsubscribeConfig?.()
    this.unsubscribeConfig = undefined
    super.destroy()
  }

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
