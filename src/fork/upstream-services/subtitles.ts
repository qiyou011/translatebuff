import { toastManager } from "@/components/ui/base-ui/toast"
import { getLocalConfig } from "@/utils/config/storage"
import { translateSubtitles as translateUpstream } from "@/utils/subtitles/processor/translator"
import { UpstreamCloudDisabledError } from "./disabled-error"
import { isBuiltInAiProviderId, resolveProviderRefForCapability } from "./provider-registry"

export * from "@/utils/subtitles/processor/translator"

export async function translateSubtitles(
  ...[fragments, videoContext, configOverride]: Parameters<typeof translateUpstream>
): ReturnType<typeof translateUpstream> {
  const config = configOverride ?? (await getLocalConfig())
  if (
    config &&
    isBuiltInAiProviderId(config.videoSubtitles.providerId) &&
    !resolveProviderRefForCapability(
      "videoSubtitles",
      config.providersConfig,
      config.videoSubtitles.providerId,
    )
  ) {
    const error = new UpstreamCloudDisabledError()
    toastManager.add({
      type: "error",
      id: "fork-subtitles-provider-unavailable",
      title: error.message,
    })
    // 原 coordinator 的 catch 会标记失败、结束 loading；不能返回“成功但译文为空”。
    throw error
  }
  return translateUpstream(fragments, videoContext, config ?? undefined)
}
