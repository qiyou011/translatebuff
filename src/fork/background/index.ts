import type { Config } from "@/types/config/config"
import { onForkMessage } from "@/fork/message"
import { computeForkConfigSync } from "@/fork/providers/renyimiao"
import { configSchema } from "@/types/config/config"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { logger } from "@/utils/logger"

type InitializedConfigReader = () => Promise<Config | null>

// 启动时同步 fork 内置 provider：补齐可用的任译喵模型实例、隐藏 OpenAI/DeepSeek/Atlas 默认 provider、
// 并把因此悬空的功能兜底到微软翻译。直接读写 storage，popup 与选项页由 storage.watch 自动感知。
async function syncForkProvidersOnStartup(
  getInitializedConfig: InitializedConfigReader,
): Promise<void> {
  const config = await getInitializedConfig()
  if (!config) {
    return
  }
  const patch = computeForkConfigSync(config)
  if (!patch) {
    return
  }
  await storageAdapter.set(CONFIG_STORAGE_KEY, mergeWithArrayOverwrite(config, patch), configSchema)
  logger.info("[Fork] provider sync applied")
}

// fork 后台接线唯一入口，所有 fork 后台逻辑从这里注册，保持上游 index.ts 只增一行
export function setupFork(getInitializedConfig: InitializedConfigReader): void {
  onForkMessage("forkPing", () => "pong")
  void syncForkProvidersOnStartup(getInitializedConfig).catch((error) => {
    logger.error("[Fork] provider sync failed", error)
  })
  logger.info("[Fork] setupFork ready")
}
