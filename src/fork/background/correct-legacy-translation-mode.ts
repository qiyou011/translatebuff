import { normalizeTranslationMode } from "@/fork/providers/translation-mode-normalization"
import { getLocalConfig, setLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"

/**
 * 纠正存量的「微软 + 仅译文」配置。
 *
 * 这个组合在新端点上线前是合法的，现在会让页面翻译直接失败（适配器对 html 输入硬抛错）。
 * 三个 UI 门禁只能挡住新组合的形成，已经躺在存量用户配置里的那份得在这里改掉。
 *
 * 上游用配置迁移（v092→v093）解决，fork 不能照做——fork 的 CONFIG_SCHEMA_VERSION 停在 86，
 * 而上游已占用 v086-to-v087.ts 至 v098-to-v099.ts，自建同名迁移下次同步必冲突（见 design D3）。
 *
 * 竞态处理：只有读到**确实带坏组合**的配置才写。新装或上游 initializeConfig 尚未跑完时
 * `getLocalConfig()` 返回 null，此时无存量可纠正、直接跳过——fork 当初把任译喵 seed 挪出
 * setupFork，踩的就是这个坑。配置损坏时 `getLocalConfig()` 回退 DEFAULT_CONFIG，而默认组合
 * 是「微软 + 双语」，不含坏组合，因此也不会误写覆盖用户配置。
 *
 * @returns 是否实际写回了纠正后的配置
 */
export async function correctLegacyTranslationMode(): Promise<boolean> {
  try {
    const config = await getLocalConfig()
    if (!config) {
      return false
    }

    const normalizedMode = normalizeTranslationMode(config)
    if (normalizedMode === config.translate.mode) {
      return false
    }

    await setLocalConfig({
      ...config,
      translate: { ...config.translate, mode: normalizedMode },
    })
    logger.info(
      `[Fork] 存量配置纠正：网页翻译模式 ${config.translate.mode} → ${normalizedMode}（当前 provider 不支持仅译文）`,
    )
    return true
  } catch (error) {
    // 纠正失败不应拖垮 setupFork 的其余接线；用户仍可在 UI 里手动改回双语。
    logger.error("[Fork] 存量翻译模式纠正失败", error)
    return false
  }
}
