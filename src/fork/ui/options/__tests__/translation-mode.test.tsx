// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it } from "vitest"
import { TranslationMode } from "@/fork/ui/options/translation-mode"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const BLOCKED_REASON_KEY = "options.translation.translationMode.microsoftNotSupported"

function buildConfig(providerId: string, mode: Config["translate"]["mode"]): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: { ...DEFAULT_CONFIG.translate, providerId, mode },
  }
}

function renderWith(config: Config) {
  const store = createStore()
  store.set(configAtom, config)
  render(
    <Provider store={store}>
      <TranslationMode />
    </Provider>,
  )
  return store
}

// options 的模式下拉是 config.translate.mode 的三个写入口之一。上游版本毫无门禁，
// 切进「仅译文」后适配器会硬抛错、页面翻译整体失败。
describe("fork options 翻译模式卡片", () => {
  it("保留上游的卡片 id——命令面板靠它跳转设置项", () => {
    const { container } = render(
      <Provider
        store={(() => {
          const s = createStore()
          s.set(configAtom, DEFAULT_CONFIG)
          return s
        })()}
      >
        <TranslationMode />
      </Provider>,
    )

    expect(container.querySelector("#translation-mode")).not.toBeNull()
  })

  it("微软激活时就地说明不可用原因", () => {
    renderWith(buildConfig("microsoft-translate-default", "bilingual"))

    expect(screen.getByText(BLOCKED_REASON_KEY)).toBeInTheDocument()
  })

  it("谷歌激活时不显示该说明", () => {
    renderWith(buildConfig("google-translate-default", "bilingual"))

    expect(screen.queryByText(BLOCKED_REASON_KEY)).toBeNull()
  })

  it("微软激活时下拉里的「仅译文」不可选", () => {
    renderWith(buildConfig("microsoft-translate-default", "bilingual"))

    fireEvent.click(screen.getByRole("combobox"))

    const option = screen.getByRole("option", {
      name: "options.translation.translationMode.mode.translationOnly",
    })
    expect(option).toHaveAttribute("aria-disabled", "true")
  })

  it("谷歌激活时下拉里的「仅译文」可选", () => {
    renderWith(buildConfig("google-translate-default", "bilingual"))

    fireEvent.click(screen.getByRole("combobox"))

    const option = screen.getByRole("option", {
      name: "options.translation.translationMode.mode.translationOnly",
    })
    expect(option).not.toHaveAttribute("aria-disabled", "true")
  })
})
