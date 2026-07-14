import { onForkMessage } from "@/fork/message"
import { logger } from "@/utils/logger"

// fork 后台接线唯一入口，所有 fork 后台逻辑从这里注册，保持上游 index.ts 只增一行
export function setupFork(): void {
  onForkMessage("forkPing", () => "pong")
  logger.info("[Fork] setupFork ready")
}
