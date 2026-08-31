import { setupMembership } from "@/fork/background/membership"
import { repairCustomActions } from "@/fork/background/repair-custom-actions"
import { setupTranslateActivity } from "@/fork/background/translate-activity"
import { onForkMessage } from "@/fork/message"
import { logger } from "@/utils/logger"

// fork 后台接线唯一入口，所有 fork 后台逻辑从这里注册，保持上游 index.ts 只增一行。
// 注：任译喵 seed 已移至 fork UI 挂载时（popup/选项页）执行——post-init、避开与上游 initializeConfig 的新装竞态。
export function setupFork(): void {
  onForkMessage("forkPing", () => "pong")
  setupMembership()
  setupTranslateActivity()
  // 补齐 i18n 未初始化时落盘的残缺自定义动作。原先塞在上游 v085-to-v086 迁移脚本里，
  // 但迁移脚本是冻结快照，且 schemaVersion ≥86 的存量用户再也不会经过那一步。
  void repairCustomActions()
  logger.info("[Fork] setupFork ready")
}
