import type { Config } from "@/types/config/config"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
} from "@/utils/constants/feature-providers"
import {
  GOOGLE_TRANSLATE_PROVIDER_ID,
  MICROSOFT_TRANSLATE_PROVIDER_ID,
} from "@/utils/constants/providers"
import { isGoogleTranslateReachable } from "@/utils/host/translate/api/google"
import { logger } from "@/utils/logger"
import { getLocalConfigAndMeta, setLocalConfig } from "./storage"

/**
 * Pick better translate providers once, after a fresh install.
 *
 * A fresh config ships with Microsoft Translate because it works everywhere, including the
 * networks where Google is blocked — that keeps install itself off the network, so the first
 * config write and the guide tab never wait on a probe that, on a blocked network, does not
 * fail fast but simply hangs. Once the user is set up we probe the real Google endpoint:
 * where Google answers, every translate feature still holding the Microsoft default moves to
 * Google, the better provider where it works. Slots the user already changed keep their
 * choice; where Google is blocked, the Microsoft default stays.
 */
type CommitConfigUpdate = (update: (current: Config) => Config) => Promise<unknown>

export async function selectFreshTranslateProviders(commit?: CommitConfigUpdate): Promise<void> {
  if (await isGoogleTranslateReachable()) {
    await promoteMicrosoftDefaultsToGoogle(commit)
  }
}

/** Move every translate feature still pointing at the Microsoft default onto Google. */
async function promoteMicrosoftDefaultsToGoogle(commit?: CommitConfigUpdate): Promise<void> {
  if (commit) {
    await commit(withGoogleDefaults)
    return
  }
  const { value: config } = await getLocalConfigAndMeta()
  const next = withGoogleDefaults(config)
  if (next === config) return
  await setLocalConfig(next)
  logger.info("[Config] Google Translate reachable, promoted it to the default translate provider")
}

function withGoogleDefaults(config: Config): Config {
  const assignments: Partial<Record<FeatureKey, string>> = {}
  for (const featureKey of FEATURE_KEYS) {
    if (
      FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config) === MICROSOFT_TRANSLATE_PROVIDER_ID
    ) {
      assignments[featureKey] = GOOGLE_TRANSLATE_PROVIDER_ID
    }
  }
  if (Object.keys(assignments).length === 0) {
    return config
  }
  return mergeWithArrayOverwrite(config, buildFeatureProviderPatch(assignments))
}
