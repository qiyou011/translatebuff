// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

// 会员门禁链会拉进 locale .yml（vitest 无对应插件），且与本次置灰无关——按上游同名
// 测试的做法把它压平：所有功能行都直接渲染选择器，provider 列表固定为纯翻译两家。
const TRANSLATE_PROVIDERS = DEFAULT_CONFIG.providersConfig.filter(
  (provider) =>
    provider.provider === "microsoft-translate" || provider.provider === "google-translate",
)

vi.mock("@/fork/ui/providers/use-renyimiao-gating", () => ({
  useRenyimiaoGatedProviders: () => ({ providers: TRANSLATE_PROVIDERS, showFallback: false }),
  RenyimiaoGatedFallback: () => null,
}))

vi.mock("@/fork/providers/use-ensure-renyimiao-seeded", () => ({
  useEnsureRenyimiaoSeeded: () => {},
}))

// 选择器里的 ProviderIcon 要 useTheme；本测试不关心主题，给个固定值免去包 ThemeProvider
vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light" }),
}))

const { FeatureProviderSelectorList } =
  await import("@/fork/ui/options/feature-provider-selector-list")

const MICROSOFT_NAME = TRANSLATE_PROVIDERS.find(
  (provider) => provider.provider === "microsoft-translate",
)!.name

function buildConfig(mode: Config["translate"]["mode"]): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: { ...DEFAULT_CONFIG.translate, mode },
  }
}

function renderWith(config: Config) {
  const store = createStore()
  store.set(configAtom, config)
  render(
    <Provider store={store}>
      <FeatureProviderSelectorList />
    </Provider>,
  )
}

/** 打开第 index 个功能行的下拉，返回其中微软那一项。FEATURE_KEYS 顺序：translate 在首位。 */
function openRowAndFindMicrosoft(index: number): HTMLElement {
  fireEvent.click(screen.getAllByRole("combobox")[index]!)
  return screen.getByRole("option", { name: new RegExp(MICROSOFT_NAME, "i") })
}

// 置灰判定必须落在持有 featureKey 的这一层，而不是共享的 ForkProviderSelector——
// 上游 provider-selector 的 4 个 importer 都被重定向到它，在组件内按 mode 置灰
// 会误伤语言检测 / 自定义动作 / 划词工具栏。
describe("fork 选项页功能 provider 列表的仅译文置灰", () => {
  it("仅译文模式下，网页翻译行的微软不可选", () => {
    renderWith(buildConfig("translationOnly"))

    expect(openRowAndFindMicrosoft(0)).toHaveAttribute("aria-disabled", "true")
  })

  it("仅译文模式下，其他功能行的微软照常可选", () => {
    renderWith(buildConfig("translationOnly"))

    expect(openRowAndFindMicrosoft(1)).not.toHaveAttribute("aria-disabled", "true")
  })

  it("双语模式下，网页翻译行的微软可选", () => {
    renderWith(buildConfig("bilingual"))

    expect(openRowAndFindMicrosoft(0)).not.toHaveAttribute("aria-disabled", "true")
  })
})
