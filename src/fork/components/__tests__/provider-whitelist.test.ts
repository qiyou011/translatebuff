import { describe, expect, it } from "vitest"
import { getForkProviderSelectorGroups } from "@/fork/components/provider-selector-groups"
import { isPureTranslateProviderConfig } from "@/types/config/provider"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"

// 上游会持续新增合作方 provider（v1.46.4 就加了 Jalapeno Cloud、Atlas Cloud，都指向
// 它自家的推广链接与 API key 页）。逐个点名去过滤必然漏，所以 fork 分组用**白名单式**：
// 只放行任译喵实例与纯翻译 provider，其余一律不呈现。
//
// 这条测试把上游全量 provider 灌进来，断言输出里一个都不多。上游下次再加合作方时，
// 它天然不会出现在 fork UI 里——不需要有人记得来改这份清单。
//
// 注意：这不是产物串扫描。jalapenocloud / atlascloud 这些标识的真源在
// utils/constants/providers.ts 等 A 类 take-theirs 文件里，扫产物只能永久红灯。
function allUpstreamProviders() {
  return Object.keys(PROVIDER_ITEMS).map(
    (provider) =>
      ({
        id: `${provider}-default`,
        provider,
        model: { customModel: "x" },
      }) as never,
  )
}

describe("fork provider 选择器的白名单式过滤", () => {
  it("上游全量 provider 灌进来，输出不含任何合作方/LLM provider", () => {
    const groups = getForkProviderSelectorGroups(allUpstreamProviders())
    const shown = groups.flatMap((group) => group.providers.map((p: any) => p.provider))

    expect(shown).not.toContain("jalapenocloud")
    expect(shown).not.toContain("atlascloud")
    expect(shown).not.toContain("openai")
    expect(shown).not.toContain("deepseek")
  })

  it("放行的一律是纯翻译 provider（不点名具体是哪几个）", () => {
    const groups = getForkProviderSelectorGroups(allUpstreamProviders())
    const shown = groups.flatMap((group) => group.providers)
    // 不硬编码「恰好是 microsoft/google/…」——上游增删纯翻译 provider 时那种写法要跟着改。
    // 断言结构性质：呈现的每一个都通过 isPureTranslateProviderConfig。
    expect(shown.length).toBeGreaterThan(0)
    for (const provider of shown) {
      expect(isPureTranslateProviderConfig(provider as never)).toBe(true)
    }
  })
})
