import type { ForkConfig } from "./schema"
import type { FeatureConfigPatch, FeatureConfigSnapshot } from "./types"
import { storage } from "#imports"
import { sendForkMessage } from "../message"

export function readFeatureConfig(): Promise<FeatureConfigSnapshot> {
  return sendForkMessage("forkReadFeatureConfig")
}

// 页面只读后台已初始化快照，绝不自行迁移或写默认值。
export async function loadForkConfig(): Promise<ForkConfig> {
  return (await readFeatureConfig()).forkConfig
}

export function patchFeatureConfig(patch: FeatureConfigPatch) {
  return sendForkMessage("forkPatchFeatureConfig", patch)
}

// 存储事件只作失效信号；旧通知不能把新配置覆盖回去。
export function subscribeFeatureConfig(
  listener: (snapshot: FeatureConfigSnapshot) => void,
  onError: (error: unknown) => void = () => {},
) {
  let active = true
  let generation = 0
  let reading = false
  let requested = false
  let lastRevision: string | undefined
  let retries = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  async function refresh() {
    if (reading) return
    reading = true
    try {
      while (requested) {
        if (!active) return
        requested = false
        const started = generation
        const snapshot = await readFeatureConfig()
        retries = 0
        if (!active) return
        if (started !== generation) {
          requested = true
          continue
        }
        if (snapshot.revision !== lastRevision) {
          lastRevision = snapshot.revision
          listener(snapshot)
        }
      }
    } catch (error) {
      if (active) {
        onError(error)
        // 扩展后台重启时消息接收端可能暂不可用；只重读，不写默认配置。
        if (!requested && retries < 3) {
          retries++
          retryTimer = setTimeout(() => {
            retryTimer = undefined
            requested = true
            void refresh()
          }, 500 * retries)
        }
      }
    } finally {
      reading = false
      if (active && requested) void refresh()
    }
  }

  const invalidate = () => {
    clearTimeout(retryTimer)
    retryTimer = undefined
    retries = 0
    generation++
    requested = true
    void refresh()
  }
  const unwatchMain = storage.watch("local:config", invalidate)
  const unwatchFork = storage.watch("local:forkConfig", invalidate)
  invalidate()
  return () => {
    active = false
    clearTimeout(retryTimer)
    unwatchMain()
    unwatchFork()
  }
}
