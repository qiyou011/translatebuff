import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BrandMark } from "@/fork/components/brand-mark"
import { ProvidersConfig } from "@/fork/ui/options/providers-config"
import { UpdateModelsButton } from "@/fork/ui/options/update-models-button"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { i18n, initI18n, setUiLanguage } from "@/utils/i18n"
import { resources, SUPPORTED_UI_LOCALES } from "@/utils/i18n/resources"

const state = vi.hoisted(() => {
  vi.stubEnv("WXT_FORK_EDITION", "global")
  return { loggedIn: false }
})
vi.unmock("@/utils/i18n")
vi.mock("@/fork/membership/atoms", () => ({
  useForkSession: () => (state.loggedIn ? { loginCredential: "fixture-only" } : null),
  useOpenForkLogin: () => () => {},
}))
vi.mock("@/fork/providers/use-ensure-renyimiao-seeded", () => ({
  useEnsureRenyimiaoSeeded: () => {},
}))
afterEach(() => {
  cleanup()
  state.loggedIn = false
  vi.unstubAllGlobals()
})

describe("海外真实语言资源", () => {
  it.each(SUPPORTED_UI_LOCALES)("%s 完整加载新增词条，品牌和数量插值可用", async (locale) => {
    await initI18n(locale)
    const translation = resources[locale]!.translation as Record<string, unknown>
    const entries = translation.forkProviders as Record<string, string>
    expect(Object.keys(entries).sort()).toEqual([
      "description",
      "fetchHint",
      "keyAfterLogin",
      "keyLoading",
      "loginEnable",
      "modelsAfterLogin",
      "modelsLabel",
      "modelsLoading",
      "updatedModels",
    ])
    expect(Object.values(entries).every((value) => value.trim().length > 0)).toBe(true)
    expect(i18n.t("forkProviders.updatedModels", [2])).toContain("2")
    expect(i18n.t("forkProviders.modelsLoading", ["TranslateBuff"])).toContain("TranslateBuff")
    expect(i18n.t("forkProviders.modelsLoading", ["TranslateBuff"])).not.toMatch(/\$1|\{\{/)
  })

  it("已登录但 key 未到达时，加载状态也使用英文", async () => {
    await initI18n("en")
    state.loggedIn = true
    const store = createStore()
    store.set(configAtom, { ...DEFAULT_CONFIG, providersConfig: [] })
    const { container } = render(
      <Provider store={store}>
        <ProvidersConfig />
      </Provider>,
    )
    expect(screen.getByText("Getting your TranslateBuff key…")).toBeInTheDocument()
    expect(screen.getByText("Getting TranslateBuff models…")).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\p{Script=Han}/u)
  })

  it("模型更新成功后显示英文数量，不出现中文成功提示", async () => {
    await initI18n("en")
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ data: [{ id: "model-a" }, { id: "model-b" }] }), {
          status: 200,
        }),
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UpdateModelsButton
          baseURL="https://gateway.example/v1"
          apiKey="fixture-only"
          onModelsFetched={() => {}}
        />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Fetch available models" }))
    expect(await screen.findByRole("button", { name: "Models updated: 2" })).toBeInTheDocument()
  })
  it("英文 API 页不再混入中文标签与未登录提示", async () => {
    await initI18n("en")
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { container } = render(
      <Provider store={store}>
        <ProvidersConfig />
      </Provider>,
    )
    expect(screen.getByText("Models")).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\p{Script=Han}/u)
    expect(screen.getByText("Models are retrieved automatically after login")).toBeInTheDocument()
  })

  it("切换中文后品牌组件与产品说明仍使用海外品牌", async () => {
    await initI18n("en")
    await setUiLanguage("zh-CN")
    render(<BrandMark />)
    expect(screen.getByText("TranslateBuff")).toBeInTheDocument()
    expect(i18n.t("options.apiProviders.pageDescription")).toContain("TranslateBuff")
    expect(i18n.t("options.apiProviders.pageDescription")).not.toContain("任译喵")
  })
})
