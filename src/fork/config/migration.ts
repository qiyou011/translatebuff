import type { Config } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { FORK_CONFIG_SCHEMA_VERSION } from "./constants"
import {
  DEFAULT_FORK_CONFIG,
  featureLanguageSchema,
  forkConfigSchema,
  type ForkConfig,
} from "./schema"

// fork 自有迁移链，独立编号，绝不与上游 CONFIG_SCHEMA_VERSION 交叉
export function migrateForkConfig(raw: unknown, mainConfig: Config = DEFAULT_CONFIG): ForkConfig {
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  if (
    typeof stored.schemaVersion === "number" &&
    stored.schemaVersion > FORK_CONFIG_SCHEMA_VERSION
  ) {
    throw new Error("Unsupported future fork configuration version")
  }
  const upgraded = stored.schemaVersion === FORK_CONFIG_SCHEMA_VERSION
  const language = {
    sourceCode: mainConfig.language.sourceCode,
    targetCode: mainConfig.language.targetCode,
  }
  const languages =
    stored.featureLanguages && typeof stored.featureLanguages === "object"
      ? (stored.featureLanguages as Record<string, unknown>)
      : {}
  return forkConfigSchema.parse({
    schemaVersion: FORK_CONFIG_SCHEMA_VERSION,
    revision: forkConfigSchema.shape.revision.safeParse(stored.revision).data ?? 0,
    membership:
      forkConfigSchema.shape.membership.safeParse(stored.membership).data ??
      DEFAULT_FORK_CONFIG.membership,
    featureLanguages: {
      selection: upgraded
        ? (featureLanguageSchema.safeParse(languages.selection).data ?? language)
        : language,
      subtitles: upgraded
        ? (featureLanguageSchema.safeParse(languages.subtitles).data ?? language)
        : language,
    },
    inputTranslation: upgraded
      ? (forkConfigSchema.shape.inputTranslation.safeParse(stored.inputTranslation).data ?? {
          triggerCount: 2,
        })
      : { triggerCount: 2 },
    translationTextColor:
      forkConfigSchema.shape.translationTextColor.safeParse(stored.translationTextColor).data ??
      null,
    translationPresetColors:
      forkConfigSchema.shape.translationPresetColors.safeParse(stored.translationPresetColors)
        .data ?? {},
  })
}

/** 纯计算迁移计划；后台负责跨存储键提交和中断恢复。 */
export function migrateFeatureConfig(mainConfig: Config, rawForkConfig: unknown) {
  const { toLang } = mainConfig.inputTranslation
  return {
    mainConfig: {
      ...mainConfig,
      inputTranslation: {
        ...mainConfig.inputTranslation,
        toLang:
          toLang === "sourceCode" || toLang === "targetCode"
            ? mainConfig.language.targetCode
            : toLang,
        enableCycle: false,
      },
    },
    forkConfig: migrateForkConfig(rawForkConfig, mainConfig),
  }
}
