import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import {
  isRenyimiaoInstance,
  RENYIMIAO_GATEWAY_BASE_URL,
  renyimiaoApiKey,
} from "@/fork/providers/renyimiao"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { computeLoginConfigPatch, computeLogoutConfigPatch } from "../key-injection"

const SK = "sk-mock-renyimiao-0000000000000000000000"

function apply(config: Config, patch: Partial<Config>): Config {
  return mergeWithArrayOverwrite(config, patch)
}

describe("computeLoginConfigPatch（登录单写 key）", () => {
  it("新装：seed 任译喵实例并把 sk_key 写进全部实例（值一致）", () => {
    const next = apply(DEFAULT_CONFIG, computeLoginConfigPatch(DEFAULT_CONFIG, SK))
    const renyi = next.providersConfig.filter(isRenyimiaoInstance)
    expect(renyi.length).toBeGreaterThan(0)
    expect(renyi.every((p) => "apiKey" in p && p.apiKey === SK)).toBe(true)
    expect(renyimiaoApiKey(next.providersConfig)).toBe(SK)
  })

  it("本迭代不写 base_url：实例 baseURL 维持网关常量", () => {
    const next = apply(DEFAULT_CONFIG, computeLoginConfigPatch(DEFAULT_CONFIG, SK))
    const renyi = next.providersConfig.filter(isRenyimiaoInstance)
    expect(renyi.every((p) => "baseURL" in p && p.baseURL === RENYIMIAO_GATEWAY_BASE_URL)).toBe(
      true,
    )
  })

  it("非任译喵 provider 不受影响", () => {
    const next = apply(DEFAULT_CONFIG, computeLoginConfigPatch(DEFAULT_CONFIG, SK))
    expect(next.providersConfig.find((p) => p.id === "openai-default")).toBeTruthy()
    expect(next.providersConfig.find((p) => p.id === "microsoft-translate-default")).toBeTruthy()
  })

  it("已有陈旧 key 时，登录把全部实例改写为新 key", () => {
    const seeded = apply(DEFAULT_CONFIG, computeLoginConfigPatch(DEFAULT_CONFIG, "stale-key"))
    const relogged = apply(seeded, computeLoginConfigPatch(seeded, SK))
    expect(renyimiaoApiKey(relogged.providersConfig)).toBe(SK)
    expect(
      relogged.providersConfig
        .filter(isRenyimiaoInstance)
        .every((p) => "apiKey" in p && p.apiKey === SK),
    ).toBe(true)
  })
})

describe("computeLogoutConfigPatch（登出清 key）", () => {
  it("把全部任译喵实例 key 清空", () => {
    const loggedIn = apply(DEFAULT_CONFIG, computeLoginConfigPatch(DEFAULT_CONFIG, SK))
    const out = apply(loggedIn, computeLogoutConfigPatch(loggedIn))
    expect(renyimiaoApiKey(out.providersConfig)).toBe("")
    expect(
      out.providersConfig
        .filter(isRenyimiaoInstance)
        .every((p) => "apiKey" in p && p.apiKey === ""),
    ).toBe(true)
  })
})
