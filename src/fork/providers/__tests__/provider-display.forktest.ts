import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { getProviderLogo } from "@/utils/providers/provider-display"

// 任译喵的托管模型都是 openai-compatible 实例，上游会一律给它们发 openai-compatible 的
// 通用图标，看不出实际用的是哪家模型。fork 按 customModel 解析出真实模型品牌图。
function renyimiaoProvider(customModel: string): ProviderConfig {
  return {
    id: `renyimiao-${customModel}`,
    provider: "openai-compatible",
    model: { customModel },
  } as unknown as ProviderConfig
}

describe("fork provider logo 解析", () => {
  it("任译喵实例按模型名解析出模型品牌图", () => {
    expect(getProviderLogo(renyimiaoProvider("deepseek-v4"), "light")).toContain("deepseek")
  })

  it("非任译喵实例仍走上游解析", () => {
    const upstream = { id: "openai-default", provider: "openai" } as unknown as ProviderConfig
    expect(getProviderLogo(upstream, "light")).not.toContain("deepseek")
  })
})
