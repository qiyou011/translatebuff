import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const BLOCKED_REASON_KEY = "options.translation.translationMode.microsoftNotSupported"
const SWITCHED_KEY = "options.translation.translationModeShortcut.switched"

let registeredHandler: (() => Promise<void>) | null = null
const unregister = vi.fn<() => void>()

// 只替换 HotkeyManager 以截获注册的回调；其余导出（detectPlatform 等）保留真身，
// 否则同批次里引用它们的模块会炸
vi.mock("@tanstack/hotkeys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/hotkeys")>()),
  HotkeyManager: {
    getInstance: () => ({
      register: (_shortcut: string, handler: () => Promise<void>) => {
        registeredHandler = handler
        return { unregister }
      },
    }),
  },
}))

const getLocalConfig = vi.fn<() => Promise<Config | null>>()
const setLocalConfig = vi.fn<(config: Config) => Promise<void>>()
vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: (...args: []) => getLocalConfig(...args),
  setLocalConfig: (...args: [Config]) => setLocalConfig(...args),
}))

const toastAdd = vi.fn<(payload: { type: string; title: string }) => void>()
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: (payload: { type: string; title: string }) => toastAdd(payload) },
}))

const { bindTranslationModeShortcutKey } = await import("../bind-translation-mode-shortcut")

function buildConfig(providerId: string, mode: Config["translate"]["mode"]): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: { ...DEFAULT_CONFIG.translate, providerId, mode },
  }
}

async function pressShortcutWith(config: Config) {
  getLocalConfig.mockResolvedValue(config)
  await bindTranslationModeShortcutKey()
  if (!registeredHandler) throw new Error("快捷键未注册")
  await registeredHandler()
}

// 这条链路至今零覆盖——既有的 translation-control/__tests__/bind-translation-shortcut.test.ts
// 测的是另一个文件（页面翻译开关），不是模式切换。
describe("fork 模式切换快捷键", () => {
  beforeEach(() => {
    registeredHandler = null
    getLocalConfig.mockReset()
    setLocalConfig.mockReset()
    setLocalConfig.mockResolvedValue(undefined)
    toastAdd.mockReset()
  })

  it("微软 + 双语时拦住不切，并弹出说明原因的 toast", async () => {
    await pressShortcutWith(buildConfig("microsoft-translate-default", "bilingual"))

    expect(setLocalConfig).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: BLOCKED_REASON_KEY }))
  })

  it("谷歌 + 双语时正常切到仅译文", async () => {
    await pressShortcutWith(buildConfig("google-translate-default", "bilingual"))

    expect(setLocalConfig).toHaveBeenCalledTimes(1)
    expect(setLocalConfig.mock.calls[0]![0].translate.mode).toBe("translationOnly")
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ title: SWITCHED_KEY }))
  })

  it("微软 + 仅译文时切回双语不受阻——门禁只拦进入方向", async () => {
    await pressShortcutWith(buildConfig("microsoft-translate-default", "translationOnly"))

    expect(setLocalConfig).toHaveBeenCalledTimes(1)
    expect(setLocalConfig.mock.calls[0]![0].translate.mode).toBe("bilingual")
  })
})
