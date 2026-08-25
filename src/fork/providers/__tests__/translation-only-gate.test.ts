import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  canEnterTranslationOnlyMode,
  providerSupportsTranslationOnlyMode,
} from "../translation-only-gate"

function withTranslateProvider(providerId: string): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: { ...DEFAULT_CONFIG.translate, providerId },
  }
}

describe("translationOnly 模式门禁", () => {
  describe("providerSupportsTranslationOnlyMode", () => {
    it("微软不支持——新端点无保留标记模式", () => {
      expect(providerSupportsTranslationOnlyMode("microsoft-translate")).toBe(false)
    })

    it("其他 provider 支持", () => {
      expect(providerSupportsTranslationOnlyMode("google-translate")).toBe(true)
      expect(providerSupportsTranslationOnlyMode("openai")).toBe(true)
    })
  })

  describe("canEnterTranslationOnlyMode", () => {
    it("默认配置的网页翻译就是微软，故不可进入", () => {
      expect(DEFAULT_CONFIG.translate.providerId).toBe("microsoft-translate-default")
      expect(canEnterTranslationOnlyMode(DEFAULT_CONFIG)).toBe(false)
    })

    it("网页翻译换成谷歌后可进入", () => {
      expect(canEnterTranslationOnlyMode(withTranslateProvider("google-translate-default"))).toBe(
        true,
      )
    })

    it("providerId 失配（解析不到 provider）时放行，不误锁用户", () => {
      expect(canEnterTranslationOnlyMode(withTranslateProvider("no-such-provider"))).toBe(true)
    })
  })
})
