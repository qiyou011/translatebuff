import type { Config } from "@/types/config/config"
import type { TranslationMode } from "@/types/config/translate"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { normalizeTranslationMode } from "../translation-mode-normalization"

function buildConfig(providerId: string, mode: TranslationMode): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: { ...DEFAULT_CONFIG.translate, providerId, mode },
  }
}

// fork 停在配置 v86 而上游已占用 v87–v99，自建同名迁移必撞车，故存量配置的
// 「微软 × 仅译文」组合改在读取时纠正，而不是写迁移脚本。
describe("网页翻译模式读时归一化", () => {
  it("微软 + 仅译文被纠正为双语", () => {
    const config = buildConfig("microsoft-translate-default", "translationOnly")
    expect(normalizeTranslationMode(config)).toBe("bilingual")
  })

  it("谷歌 + 仅译文原样返回", () => {
    const config = buildConfig("google-translate-default", "translationOnly")
    expect(normalizeTranslationMode(config)).toBe("translationOnly")
  })

  it("微软 + 双语原样返回", () => {
    const config = buildConfig("microsoft-translate-default", "bilingual")
    expect(normalizeTranslationMode(config)).toBe("bilingual")
  })

  it("纯函数：不改写传入的 config", () => {
    const config = buildConfig("microsoft-translate-default", "translationOnly")
    const snapshot = JSON.stringify(config)

    normalizeTranslationMode(config)

    expect(JSON.stringify(config)).toBe(snapshot)
    expect(config.translate.mode).toBe("translationOnly")
  })
})
