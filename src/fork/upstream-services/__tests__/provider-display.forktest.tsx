// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getFeatureLabelI18nKey } from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"

const candidate = {
  id: "renyimiao-test",
  name: "Actual translation model",
  enabled: true,
  provider: "openai-compatible" as const,
  apiKey: "test-key",
  baseURL: "https://gateway.example/v1",
  model: { model: "use-custom-model" as const, isCustomModel: true, customModel: "test-model" },
}
vi.mock("@/fork/ui/providers/use-renyimiao-gating", () => ({
  useRenyimiaoGatedProviders: () => ({ providers: [candidate], showFallback: false }),
  RenyimiaoGatedFallback: () => null,
}))
vi.mock("@/fork/providers/use-ensure-renyimiao-seeded", () => ({
  useEnsureRenyimiaoSeeded: () => {},
}))
vi.mock("@/components/providers/theme-provider", () => ({ useTheme: () => ({ theme: "light" }) }))
const { FeatureProviderSelectorList } =
  await import("@/fork/ui/options/feature-provider-selector-list")
const { FeatureProvidersConfig } =
  await import("@/entrypoints/options/pages/api-providers/feature-providers")
afterEach(cleanup)

describe("resolved model presentation", () => {
  it("also hides disabled note settings in the actual API providers page section", () => {
    const store = createStore()
    store.set(configAtom, {
      ...DEFAULT_CONFIG,
      providersConfig: [...DEFAULT_CONFIG.providersConfig, candidate],
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, providerId: "read-frog-free-ai" },
    })
    render(
      <Provider store={store}>
        <FeatureProvidersConfig />
      </Provider>,
    )
    expect(
      screen.queryByText(i18n.t(getFeatureLabelI18nKey("noteSuggestion"))),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent(candidate.name)
  })
  it("does not expose a model setting for disabled note suggestions", () => {
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    render(
      <Provider store={store}>
        <FeatureProviderSelectorList />
      </Provider>,
    )
    expect(
      screen.queryByText(i18n.t(getFeatureLabelI18nKey("noteSuggestion"))),
    ).not.toBeInTheDocument()
  })
  it("shows the effective model for a legacy page selection without persisting a replacement", () => {
    const config = {
      ...DEFAULT_CONFIG,
      providersConfig: [...DEFAULT_CONFIG.providersConfig, candidate],
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, providerId: "read-frog-free-ai" },
    }
    const store = createStore()
    store.set(configAtom, config)
    render(
      <Provider store={store}>
        <FeatureProviderSelectorList />
      </Provider>,
    )
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent(candidate.name)
    expect(store.get(configAtom).pageTranslation.providerId).toBe("read-frog-free-ai")
  })
})
