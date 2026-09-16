import { resolveChannelNumber } from "@/fork/identity/channel"
import { readForkVersion } from "@/fork/identity/version"
import { SAAS_PRODUCT_LINE } from "@/fork/membership/api"
import { toClientLanguage } from "@/fork/membership/client-language"
import { loadForkSession } from "@/fork/membership/session"
import { configSchema } from "@/types/config/config"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { resolveUiLocale } from "@/utils/i18n/locale-map"
import { getReportDeviceInfo } from "./device-info"
import { postClickEvent } from "./report-client"

export type LaunchType = "install" | "update" | "startup"

export async function reportAppStartUp(launchType: LaunchType, now = Date.now()): Promise<void> {
  try {
    const [session, config, deviceInfo] = await Promise.all([
      loadForkSession(),
      storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema),
      getReportDeviceInfo(),
    ])
    await postClickEvent(
      [
        {
          trace_id: crypto.randomUUID(),
          click_time: now,
          click_name: "app_start_up",
          client_type: 10,
          client_version: readForkVersion(),
          product_line: SAAS_PRODUCT_LINE,
          event_type: "lifecycle",
          device_info: deviceInfo,
          action_extra_info: {
            launch_type: launchType,
            launch_channel_id: Number(resolveChannelNumber()),
          },
        },
      ],
      {
        loginCredential: session?.loginCredential ?? null,
        clientLanguage: toClientLanguage(resolveUiLocale(config.uiLanguage)),
      },
    )
  } catch {
    // 与活跃事件独立，不去重、不重试，也不触发会员接口的 401 清态。
  }
}
