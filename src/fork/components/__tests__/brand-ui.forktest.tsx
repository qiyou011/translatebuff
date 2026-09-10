// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TranslationCard } from "@/entrypoints/translation-hub/components/translation-card"
import { BrandMark } from "@/fork/components/brand-mark"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { ProvidersConfig } from "@/fork/ui/options/providers-config"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

vi.mock("@/components/providers/theme-provider", () => ({ useTheme: () => ({ theme: "light" }) }))
vi.mock("@/fork/membership/atoms", () => ({
  useForkSession: () => null,
  useOpenForkLogin: () => () => {},
}))
vi.mock("@/fork/providers/use-ensure-renyimiao-seeded", () => ({
  useEnsureRenyimiaoSeeded: () => {},
}))

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe("发行版品牌与真实卡片展示", () => {
  it.each([
    ["global", "TranslateBuff"],
    ["cn", "任译喵"],
  ])("%s 品牌不取决于界面词条", (edition, name) => {
    vi.stubEnv("WXT_FORK_EDITION", edition)
    render(<BrandMark />)
    expect(screen.getByText(name)).toBeInTheDocument()
  })

  it("海外 API 分组标题不显示中文品牌", () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    render(
      <Provider store={store}>
        <ProvidersConfig />
      </Provider>,
    )
    expect(screen.getByRole("heading", { name: "TranslateBuff API" })).toBeInTheDocument()
  })

  it.each(["任译喵 GLM-5.3-Flash", "TranslateBuff GLM-5.3-Flash"])(
    "真实结果卡片去掉 %s 的前缀且不写回配置",
    (name) => {
      const provider = { ...buildRenyimiaoProvider("GLM-5.3-Flash"), name }
      const config = { ...DEFAULT_CONFIG, providersConfig: [provider] }
      const store = createStore()
      store.set(configAtom, config)
      render(
        <QueryClientProvider client={new QueryClient()}>
          <Provider store={store}>
            <TranslationCard
              providerId={provider.id}
              isExpanded={true}
              onExpandedChange={() => {}}
            />
          </Provider>
        </QueryClientProvider>,
      )
      expect(screen.getByText("GLM-5.3-Flash")).toBeInTheDocument()
      expect(screen.queryByText(name)).not.toBeInTheDocument()
      expect(store.get(configAtom)).toEqual(config)
    },
  )
})
