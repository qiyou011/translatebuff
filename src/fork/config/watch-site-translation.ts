import type { Config } from "@/types/config/config"
import { storage } from "#imports"
import { configSchema } from "@/types/config/config"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { getEffectiveSiteControlUrl, isSiteEnabled } from "@/utils/site-control"

export function watchSiteTranslation(manager: { stop: () => void }) {
  return storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (raw) => {
    const parsed = configSchema.safeParse(raw)
    if (parsed.success && !isSiteEnabled(getEffectiveSiteControlUrl(location.href), parsed.data)) {
      // stop() also cancels pending starts and invalidates queued/in-flight page writes.
      manager.stop()
    }
  })
}
