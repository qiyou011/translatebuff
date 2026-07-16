import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { describe, expect, it } from "vitest"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { getForkProviderSelectorGroups } from "../provider-selector-groups"

const renyimiao = buildRenyimiaoProvider("Deepseek-V4-Flash") // 任译喵实例，id 前缀 renyimiao-
const renyimiao2 = buildRenyimiaoProvider("GLM-5.2") // 另一模型实例（多实例）
const userLLM = DEFAULT_PROVIDER_CONFIG.openai // 非任译喵 LLM（应被隐藏）
const translateProvider = DEFAULT_PROVIDER_CONFIG["microsoft-translate"] // 纯翻译
const systemItem = {
  kind: "system",
  id: "read-frog-free-ai",
  name: "Free AI",
} as unknown as ProviderSelectorOption // 免费AI（应被隐藏）

describe("getForkProviderSelectorGroups", () => {
  it("只呈现任译喵组（置顶）与普通翻译组", () => {
    const groups = getForkProviderSelectorGroups([
      userLLM,
      translateProvider,
      renyimiao,
      systemItem,
    ])
    expect(groups.map((g) => g.key)).toEqual(["renyimiao", "normalTranslator"])
  })

  it("任译喵实例进任译喵组、纯翻译进普通翻译组", () => {
    const groups = getForkProviderSelectorGroups([renyimiao, translateProvider])
    expect(groups.find((g) => g.key === "renyimiao")!.providers.map((p) => p.id)).toContain(
      renyimiao.id,
    )
    expect(groups.find((g) => g.key === "normalTranslator")!.providers.map((p) => p.id)).toContain(
      translateProvider.id,
    )
  })

  it("其它 LLM 与 免费AI system item 都被隐藏（不出现在任何组）", () => {
    const groups = getForkProviderSelectorGroups([
      userLLM,
      systemItem,
      renyimiao,
      translateProvider,
    ])
    const allIds = groups.flatMap((g) => g.providers.map((p) => p.id))
    expect(allIds).not.toContain(userLLM.id)
    expect(allIds).not.toContain(systemItem.id)
  })

  it("空组过滤（只任译喵时只 1 组）", () => {
    const groups = getForkProviderSelectorGroups([renyimiao])
    expect(groups.map((g) => g.key)).toEqual(["renyimiao"])
  })

  it("多个任译喵模型实例平铺进任译喵组", () => {
    const groups = getForkProviderSelectorGroups([renyimiao, renyimiao2, translateProvider])
    const renyimiaoIds = groups.find((g) => g.key === "renyimiao")!.providers.map((p) => p.id)
    expect(renyimiaoIds).toContain(renyimiao.id)
    expect(renyimiaoIds).toContain(renyimiao2.id)
    expect(renyimiaoIds).toHaveLength(2)
  })
})
