import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { getProviderLogo, getProviderName } from "@/utils/providers/provider-display"

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

describe("fork provider 展示名称", () => {
  it("兼容英文品牌前缀，仍只展示模型名", () => {
    const provider = { ...renyimiaoProvider("GLM-5.3-Flash"), name: "TranslateBuff GLM-5.3-Flash" }
    expect(getProviderName(provider)).toBe("GLM-5.3-Flash")
  })
  it("已有任译喵配置显示纯模型名，不修改存储名称或模型标识", () => {
    const provider = {
      ...renyimiaoProvider("Deepseek-V4-Flash"),
      name: "任译喵 Deepseek-V4-Flash",
    }
    const before = structuredClone(provider)

    expect(getProviderName(provider)).toBe("Deepseek-V4-Flash")
    expect(provider).toEqual(before)
  })

  it("无品牌前缀的任译喵名称保持不变", () => {
    const provider = { ...renyimiaoProvider("GLM-5.2"), name: "GLM-5.2" }
    expect(getProviderName(provider)).toBe("GLM-5.2")
  })

  it("非任译喵配置即使同名前缀也不改写", () => {
    const provider = {
      ...renyimiaoProvider("GLM-5.2"),
      id: "user-custom-provider",
      name: "任译喵 自定义名称",
    }
    expect(getProviderName(provider)).toBe("任译喵 自定义名称")
  })
})
