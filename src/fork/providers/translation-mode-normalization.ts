import type { Config } from "@/types/config/config"
import type { TranslationMode } from "@/types/config/translate"
import { canEnterTranslationOnlyMode } from "./translation-only-gate"

/**
 * 存量用户可能已经选中「微软 + 仅译文」——那是新端点上线前的合法组合，现在会损坏页面。
 *
 * 上游走的是配置迁移（v092→v093），fork 不能照做：fork 的 CONFIG_SCHEMA_VERSION 停在 86，
 * 而上游已占用 v086-to-v087.ts 至 v098-to-v099.ts，自建同名迁移会在下次同步时正面冲突，
 * 且迁移链属 fork 边界纪律的 A 类「绝不改」。
 *
 * 故改为读时纠正：纯函数、不写回存储——写回会与上游 ensureInitializedConfig 抢时序，
 * 而对用户来说读时纠正的效果等价。
 */
export function normalizeTranslationMode(config: Config): TranslationMode {
  const mode = config.translate.mode
  if (mode === "translationOnly" && !canEnterTranslationOnlyMode(config)) {
    return "bilingual"
  }
  return mode
}
