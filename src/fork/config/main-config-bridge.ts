import type { Config } from "@/types/config/config"
import { sendForkMessage } from "@/fork/message"
import { setConfigCommitter } from "@/utils/atoms/config"
import { readFeatureConfig } from "./storage"

/** Existing UI updaters participate in the same background transaction as quick settings. */
export async function commitMainConfigUpdate(update: (current: Config) => Config) {
  let pair = await readFeatureConfig()
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await sendForkMessage("forkReplaceFeatureConfig", {
      expectedRevision: pair.revision,
      mainConfig: update(structuredClone(pair.mainConfig)),
      forkConfig: pair.forkConfig,
    })
    pair = result.snapshot
    if (result.ok) return pair.mainConfig
  }
  throw new Error("Configuration changed repeatedly; please retry")
}

export function installFeatureConfigBridge() {
  setConfigCommitter(commitMainConfigUpdate)
}
