// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CustomCssPage } from "@/entrypoints/options/pages/translation/translation-style/custom-css"
import { StylePreview } from "@/entrypoints/options/pages/translation/translation-style/style-preview"
import { SubtitlesPreview } from "@/entrypoints/options/pages/video-subtitles/subtitles-style/style-editor/subtitles-preview"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { initI18n } from "@/utils/i18n"
import { LocaleBoundary } from "@/utils/i18n/locale-boundary"
import { resources, SUPPORTED_UI_LOCALES } from "@/utils/i18n/resources"

vi.unmock("@/utils/i18n")
vi.unmock("@/utils/i18n/locale-boundary")
// jsdom does not navigate srcdoc; retain the real preview content, replace only its frame.
vi.mock("@/entrypoints/options/pages/translation/translation-style/page-preview-frame", () => ({
  PagePreviewFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock(
  "@/entrypoints/options/pages/video-subtitles/subtitles-style/style-editor/shadow-preview-frame",
  () => ({
    ShadowPreviewFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }),
)
// CodeMirror's layout is unrelated to sample state and unsupported in jsdom.
vi.mock("@/components/ui/css-code-editor", () => ({ CSSCodeEditor: () => null }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const english =
  "Mr. Kamiya is not fighting against the world, but against things that could make the world take notice."
const chinese = "神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。"

async function mount(children: ReactNode) {
  await initI18n("en")
  const store = createStore()
  store.set(configAtom, { ...DEFAULT_CONFIG, uiLanguage: "en" })
  const result = render(
    <Provider store={store}>
      <LocaleBoundary>
        <MemoryRouter>{children}</MemoryRouter>
      </LocaleBoundary>
    </Provider>,
  )
  await act(async () => {})
  await act(async () => store.set(configAtom, { ...DEFAULT_CONFIG, uiLanguage: "en" }))
  return { ...result, store }
}

describe("静态预览随界面语言变化", () => {
  it.each(["cn", "global"])(
    "%s 页面示例随界面语言切换，不依赖发行版或翻译请求",
    async (edition) => {
      vi.stubEnv("WXT_FORK_EDITION", edition)
      const fetchSpy = vi.fn<typeof fetch>(() => {
        throw new Error("preview must not fetch")
      })
      vi.stubGlobal("fetch", fetchSpy)
      const { store } = await mount(<StylePreview />)
      expect(screen.getByText(english).closest("[lang]")).toHaveAttribute("lang", "en")
      await act(async () =>
        store.set(configAtom, { ...store.get(configAtom), uiLanguage: "zh-CN" }),
      )
      expect(screen.getByText(chinese).closest("[lang]")).toHaveAttribute("lang", "zh")
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )

  it("字幕原文保留英文，示例译文随语言切换", async () => {
    const { store } = await mount(<SubtitlesPreview />)
    expect(screen.getAllByText(english)).toHaveLength(2)
    await act(async () => store.set(configAtom, { ...store.get(configAtom), uiLanguage: "zh-CN" }))
    expect(screen.getByText(english)).toBeInTheDocument()
    expect(screen.getByText(chinese)).toBeInTheDocument()
  })

  it("CSS 默认示例跟随语言，手动编辑和清空后不被语言切换覆盖", async () => {
    const { store, container } = await mount(<CustomCssPage />)
    expect(container.querySelector("#preview-text")).toHaveValue(english)
    await act(async () => store.set(configAtom, { ...store.get(configAtom), uiLanguage: "zh-CN" }))
    expect(container.querySelector("#preview-text")).toHaveValue(chinese)
    fireEvent.change(container.querySelector("#preview-text")!, { target: { value: "my sample" } })
    await act(async () => store.set(configAtom, { ...store.get(configAtom), uiLanguage: "ja" }))
    expect(container.querySelector("#preview-text")).toHaveValue("my sample")
    fireEvent.change(container.querySelector("#preview-text")!, { target: { value: "" } })
    await act(async () => store.set(configAtom, { ...store.get(configAtom), uiLanguage: "en" }))
    expect(container.querySelector("#preview-text")).toHaveValue("")
  })

  it("九种语言均有非空静态示例，不使用中文兜底", () => {
    const samples = SUPPORTED_UI_LOCALES.map((locale) => {
      const sample = (resources[locale]!.translation as Record<string, { sampleText?: string }>)
        .forkPreview?.sampleText
      expect(sample).toBeTruthy()
      return sample
    })
    expect(new Set(samples).size).toBe(9)
  })
})
