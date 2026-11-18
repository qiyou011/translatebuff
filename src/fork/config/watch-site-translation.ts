import type { Config } from "@/types/config/config"
import { dequal } from "dequal"
import { storage } from "#imports"
import { configSchema } from "@/types/config/config"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { getEffectiveSiteControlUrl, isSiteEnabled } from "@/utils/site-control"

export function watchSiteTranslation(manager: {
  stop: () => void
  start: () => unknown
  readonly isActive: boolean
}) {
  return storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (raw, previous) => {
    const parsed = configSchema.safeParse(raw)
    if (parsed.success && !isSiteEnabled(getEffectiveSiteControlUrl(location.href), parsed.data)) {
      // stop() also cancels pending starts and invalidates queued/in-flight page writes.
      manager.stop()
      return
    }
    const before = configSchema.safeParse(previous)
    if (!parsed.success || !before.success) return
    const current = parsed.data
    const old = before.data
    if (
      current.pageTranslation.mode !== old.pageTranslation.mode ||
      current.pageTranslation.providerId !== old.pageTranslation.providerId ||
      !dequal(current.language, old.language) ||
      !dequal(
        current.providersConfig.find(
          (provider) => provider.id === current.pageTranslation.providerId,
        ),
        old.providersConfig.find((provider) => provider.id === old.pageTranslation.providerId),
      )
    ) {
      const restart = manager.isActive
      manager.stop()
      if (restart) void manager.start()
    }
  })
}
