import { setupMembership } from "@/fork/background/membership"
import { onForkMessage } from "@/fork/message"
import { logger } from "@/utils/logger"

// fork 后台接线唯一入口，所有 fork 后台逻辑从这里注册，保持上游 index.ts 只增一行。
// 注：任译喵 seed 已移至 fork UI 挂载时（popup/选项页）执行——post-init、避开与上游 initializeConfig 的新装竞态。
export function setupFork(): void {
  onForkMessage("forkPing", () => "pong")
  setupMembership()
  logger.info("[Fork] setupFork ready")
}
