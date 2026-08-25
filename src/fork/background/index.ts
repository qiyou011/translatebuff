import { correctLegacyTranslationMode } from "@/fork/background/correct-legacy-translation-mode"
import { setupMembership } from "@/fork/background/membership"
import { repairCustomActions } from "@/fork/background/repair-custom-actions"
import { onForkMessage } from "@/fork/message"
import { logger } from "@/utils/logger"

// fork 后台接线唯一入口，所有 fork 后台逻辑从这里注册，保持上游 index.ts 只增一行。
// 注：任译喵 seed 已移至 fork UI 挂载时（popup/选项页）执行——post-init、避开与上游 initializeConfig 的新装竞态。
export function setupFork(): void {
  onForkMessage("forkPing", () => "pong")
  setupMembership()
  // 存量「微软 + 仅译文」纠正。与上面的 seed 不同，它对新装竞态免疫——读到 null 就跳过，
  // 只有确实带坏组合的存量配置才写（见该模块注释）。不 await：纠正失败已在内部兜住，
  // 且后台启动不该被一次存储读写阻塞。
  void correctLegacyTranslationMode()
  // 补齐 i18n 未初始化时落盘的残缺自定义动作。原先塞在上游 v085-to-v086 迁移脚本里，
  // 但迁移脚本是冻结快照，且 schemaVersion ≥86 的存量用户再也不会经过那一步。
  void repairCustomActions()
  logger.info("[Fork] setupFork ready")
}
