// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it } from "vitest"
import TranslationModeSelector from "@/fork/ui/popup/translation-mode-selector"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

function buildConfig(providerId: string, mode: Config["pageTranslation"]["mode"]): Config {
  return {
    ...DEFAULT_CONFIG,
    pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, providerId, mode },
  }
}

function renderWith(config: Config) {
  const store = createStore()
  store.set(configAtom, config)
  render(
    <Provider store={store}>
      <TranslationModeSelector />
    </Provider>,
  )
  return store
}

// 微软的免鉴权端点无保留标记模式，与仅译文（innerHTML 重渲染）组合会损坏页面。
// popup 这个按钮是 config.pageTranslation.mode 的三个写入口之一，必须拦住。
describe("fork popup 模式切换按钮", () => {
  it("微软 + 双语时按钮呈禁用态，点击不改模式", async () => {
    const store = renderWith(buildConfig("microsoft-translate-default", "bilingual"))
    const button = screen.getByRole("button")

    expect(button).toHaveAttribute("aria-disabled", "true")

    fireEvent.click(button)
    await Promise.resolve()

    expect(store.get(configAtom).pageTranslation.mode).toBe("bilingual")
  })

  it("谷歌 + 双语时正常切到仅译文", async () => {
    const store = renderWith(buildConfig("google-translate-default", "bilingual"))
    const button = screen.getByRole("button")

    expect(button).not.toHaveAttribute("aria-disabled")

    fireEvent.click(button)
    await Promise.resolve()

    expect(store.get(configAtom).pageTranslation.mode).toBe("translationOnly")
  })

  it("微软 + 仅译文时切回双语不受阻——门禁只拦进入方向", async () => {
    const store = renderWith(buildConfig("microsoft-translate-default", "translationOnly"))
    const button = screen.getByRole("button")

    expect(button).not.toHaveAttribute("aria-disabled")

    fireEvent.click(button)
    await Promise.resolve()

    expect(store.get(configAtom).pageTranslation.mode).toBe("bilingual")
  })
})
