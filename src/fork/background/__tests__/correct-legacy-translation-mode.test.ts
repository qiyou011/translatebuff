import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const getLocalConfig = vi.fn<() => Promise<Config | null>>()
const setLocalConfig = vi.fn<(config: Config) => Promise<void>>()
vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: () => getLocalConfig(),
  setLocalConfig: (config: Config) => setLocalConfig(config),
}))

const { correctLegacyTranslationMode } = await import("../correct-legacy-translation-mode")

function buildConfig(providerId: string, mode: Config["translate"]["mode"]): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: { ...DEFAULT_CONFIG.translate, providerId, mode },
  }
}

// 存量用户可能停在「微软 + 仅译文」——新端点上线前的合法组合，现在会让页面翻译直接失败
// （适配器对 html 硬抛错）。三个 UI 门禁只挡新组合形成，纠正存量得靠这里。
//
// 不写上游迁移的原因见 design D3（fork 停在 v86、上游已占用 v87–v99，自建同名迁移必撞车）。
describe("存量「微软 + 仅译文」配置纠正", () => {
  beforeEach(() => {
    getLocalConfig.mockReset()
    setLocalConfig.mockReset()
    setLocalConfig.mockResolvedValue(undefined)
  })

  it("读到坏组合时纠正为双语，其余字段原样写回", async () => {
    const stored = buildConfig("microsoft-translate-default", "translationOnly")
    getLocalConfig.mockResolvedValue(stored)

    await expect(correctLegacyTranslationMode()).resolves.toBe(true)

    expect(setLocalConfig).toHaveBeenCalledTimes(1)
    const written = setLocalConfig.mock.calls[0][0]
    expect(written.translate.mode).toBe("bilingual")
    expect(written.translate.providerId).toBe("microsoft-translate-default")
    expect({ ...written, translate: stored.translate }).toEqual(stored)
  })

  it("谷歌 + 仅译文不动", async () => {
    getLocalConfig.mockResolvedValue(buildConfig("google-translate-default", "translationOnly"))

    await expect(correctLegacyTranslationMode()).resolves.toBe(false)
    expect(setLocalConfig).not.toHaveBeenCalled()
  })

  it("微软 + 双语不动", async () => {
    getLocalConfig.mockResolvedValue(buildConfig("microsoft-translate-default", "bilingual"))

    await expect(correctLegacyTranslationMode()).resolves.toBe(false)
    expect(setLocalConfig).not.toHaveBeenCalled()
  })

  // 新装 / 上游 initializeConfig 尚未跑完时 getLocalConfig 返回 null。此时无存量可纠正，
  // 必须安静跳过——这正是 fork 当初把任译喵 seed 挪出 setupFork 的那个竞态。
  it("配置尚未初始化时安静跳过，不写不抛", async () => {
    getLocalConfig.mockResolvedValue(null)

    await expect(correctLegacyTranslationMode()).resolves.toBe(false)
    expect(setLocalConfig).not.toHaveBeenCalled()
  })

  it("读取抛错时不冒泡到 setupFork", async () => {
    getLocalConfig.mockRejectedValue(new Error("storage unavailable"))

    await expect(correctLegacyTranslationMode()).resolves.toBe(false)
    expect(setLocalConfig).not.toHaveBeenCalled()
  })
})
