import type { ProvidersConfig } from "@/types/config/provider"
import type { CustomActionProviderRef } from "@/utils/providers/provider-registry"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import {
  BUILT_IN_AI_PROVIDER_ID,
  resolveProviderRefForCapability,
} from "@/utils/providers/provider-registry"
import { withRenyimiaoJsonObjectFormat } from "../custom-action-response-format"
import { buildRenyimiaoProvider } from "../renyimiao"

// 用真实 resolver 造 customAction provider ref（与 use-custom-action-controller.ts:93 同款路径），
// 避免手搓 ref 形状——registry 改 ref 结构时测试自动跟随。
function resolveRef(providersConfig: ProvidersConfig, id: string): CustomActionProviderRef {
  const ref = resolveProviderRefForCapability("customAction", providersConfig, id)
  if (!ref) {
    throw new Error(`无法解析 provider ref：${id}`)
  }
  return ref
}

// 任译喵 openai-compatible 实例的 customAction ref。
function renyimiaoRef(modelId = "Deepseek-V4-Flash"): CustomActionProviderRef {
  const config = buildRenyimiaoProvider(modelId)
  return resolveRef([config], config.id)
}

describe("withRenyimiaoJsonObjectFormat（词典结构化输出降级）", () => {
  it("任译喵 ref：providerOptions 内层注入 response_format=json_object", () => {
    const ref = withRenyimiaoJsonObjectFormat(renyimiaoRef())
    expect(ref?.kind).toBe("local")
    expect(ref?.kind === "local" ? ref.config.providerOptions : undefined).toMatchObject({
      response_format: { type: "json_object" },
    })
  })

  it("集成断言：透传给 streamText 的 providerOptions 为 { 'openai-compatible': { thinking:disabled, response_format:json_object } }", () => {
    // 复刻执行链 buildCustomActionExecutionRequest(:230-238) 的 providerOptions 计算——
    // 用同一个导出函数 getProviderOptionsWithOverride，验证 helper 注入经透传后到 streamText 入参层。
    const ref = withRenyimiaoJsonObjectFormat(renyimiaoRef("Deepseek-V4-Flash"))
    if (ref?.kind !== "local") {
      throw new Error("expected local ref")
    }
    const providerOptions = getProviderOptionsWithOverride(
      resolveModelId(ref.config.model) ?? "",
      ref.config.provider,
      ref.config.providerOptions,
      undefined,
    )
    expect(providerOptions).toEqual({
      "openai-compatible": {
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      },
    })
  })

  it("合入 recommended 由 model 泛化推导（换模型自动正确，非硬编码）", () => {
    // Deepseek-V4-Pro 同命中 deepseek recommended（thinking:disabled）。
    const ref = withRenyimiaoJsonObjectFormat(renyimiaoRef("Deepseek-V4-Pro"))
    expect(ref?.kind === "local" ? ref.config.providerOptions : undefined).toMatchObject({
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    })
  })

  it("不可变：返回新 ref+新 config，原始 config 不被污染", () => {
    const original = renyimiaoRef()
    const originalConfig = original.kind === "local" ? original.config : null
    const result = withRenyimiaoJsonObjectFormat(original)
    expect(result).not.toBe(original)
    expect(result?.kind === "local" ? result.config : null).not.toBe(originalConfig)
    // 原 config.providerOptions 保持不变（构造时未设，应仍为 undefined）
    expect(originalConfig?.providerOptions).toBeUndefined()
  })

  it("豁免：system ref（内置免费 AI）原样返回、不注入", () => {
    const systemRef = resolveRef([], BUILT_IN_AI_PROVIDER_ID)
    expect(systemRef.kind).toBe("system")
    expect(withRenyimiaoJsonObjectFormat(systemRef)).toBe(systemRef)
  })

  it("豁免：非任译喵 local ref（用户自带 LLM，如 openai）原样返回、不注入", () => {
    const openai = DEFAULT_CONFIG.providersConfig.find((item) => item.provider === "openai")
    if (!openai) {
      throw new Error("默认配置缺 openai provider")
    }
    const ref = resolveRef(DEFAULT_CONFIG.providersConfig, openai.id)
    expect(withRenyimiaoJsonObjectFormat(ref)).toBe(ref)
  })

  it("null 透传", () => {
    expect(withRenyimiaoJsonObjectFormat(null)).toBeNull()
  })
})
