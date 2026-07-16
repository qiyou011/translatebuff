import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { getForkModelLogo } from "../provider-logo"

function createForkProvider(modelId: string): ProviderConfig {
  return {
    id: `renyimiao-${modelId}`,
    name: `任译喵 ${modelId}`,
    enabled: true,
    provider: "openai-compatible",
    baseURL: "https://example.com/v1",
    model: {
      model: "use-custom-model",
      isCustomModel: true,
      customModel: modelId,
    },
  }
}

describe("getForkModelLogo", () => {
  it.each([
    ["Deepseek-V4-Flash", "deepseek-color.webp"],
    ["gpt-5.5", "openai.webp"],
    ["qwen3.5-plus", "qwen-color.webp"],
  ])("maps %s to its model brand icon", (modelId, iconFile) => {
    expect(getForkModelLogo(createForkProvider(modelId), "light")).toContain(iconFile)
  })

  it("keeps user-created compatible providers on the generic icon", () => {
    const provider = { ...createForkProvider("Deepseek-V4-Flash"), id: "custom-provider" }

    expect(getForkModelLogo(provider, "light")).toBeUndefined()
  })
})
