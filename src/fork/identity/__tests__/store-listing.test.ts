import { afterEach, describe, expect, it, vi } from "vitest"
import { FORK_BRANDING, getForkDisplayName } from "../../branding"

const editions = [
  {
    edition: "cn",
    title: "任译喵 - AI 翻译与双语阅读",
    brand: "任译喵",
    geckoId: "translatebuff@translatebuff.com",
  },
  {
    edition: "global",
    title: "TranslateBuff – AI Translator & Reader",
    brand: "TranslateBuff",
    geckoId: "overseas@translatebuff.com",
  },
] as const

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("正式包的商店可见名称", () => {
  it.each(editions)(
    "$edition 的 manifest 名称不改变运行时品牌与身份",
    async ({ edition, title, brand, geckoId }) => {
      vi.stubEnv("WXT_FORK_EDITION", edition)
      vi.resetModules()
      const { default: config } = await import("../../../../wxt.config")
      if (typeof config.manifest !== "function") throw new Error("manifest factory missing")
      const chrome = await config.manifest({
        mode: "production",
        command: "build",
        browser: "chrome",
        manifestVersion: 3,
      })
      const firefox = await config.manifest({
        mode: "production",
        command: "build",
        browser: "firefox",
        manifestVersion: 3,
      })

      expect(chrome.name).toBe(title)
      expect(firefox.name).toBe(title)
      expect(firefox.browser_specific_settings?.gecko?.id).toBe(geckoId)
      expect(config.zip?.artifactTemplate).toContain("translatebuff-")
      expect(FORK_BRANDING.name).toBe("TranslateBuff")
      expect(getForkDisplayName(edition)).toBe(brand)
      expect(chrome.version_name).toContain(brand)
      expect(chrome.version_name).not.toContain(title)
    },
  )
})
