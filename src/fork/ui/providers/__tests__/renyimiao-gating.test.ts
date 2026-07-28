import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { describe, expect, it } from "vitest"
import { buildRenyimiaoProvider, renyimiaoInstanceId } from "@/fork/providers/renyimiao"
import { computeRenyimiaoGating } from "../renyimiao-gating"

// 任译喵项用真 builder（id 带前缀，isRenyimiaoInstance 命中）；非任译喵用 system 展示项。
const renyimiao = (modelId: string): ProviderSelectorOption => buildRenyimiaoProvider(modelId)
const other = (id: string): ProviderSelectorOption => ({
  kind: "system",
  id,
  logo: () => "",
  name: id,
})

describe("computeRenyimiaoGating", () => {
  it("key 非空：不过滤任译喵、不 fallback", () => {
    const all = [renyimiao("m1"), other("microsoft")]
    const result = computeRenyimiaoGating(all, "sk-live", renyimiaoInstanceId("m1"))
    expect(result.providers.map((p) => p.id)).toEqual(all.map((p) => p.id))
    expect(result.showFallback).toBe(false)
  })

  it("key 空：过滤掉任译喵项", () => {
    const all = [renyimiao("m1"), other("microsoft")]
    const result = computeRenyimiaoGating(all, "", "microsoft")
    expect(result.providers.map((p) => p.id)).toEqual(["microsoft"])
  })

  it("key 空、过滤后为空：showFallback", () => {
    const all = [renyimiao("m1")]
    const result = computeRenyimiaoGating(all, "", renyimiaoInstanceId("m1"))
    expect(result.providers).toEqual([])
    expect(result.showFallback).toBe(true)
  })

  it("key 空、选中即任译喵（另有非任译喵）：showFallback（防孤儿 value）", () => {
    const all = [renyimiao("m1"), other("microsoft")]
    const result = computeRenyimiaoGating(all, "", renyimiaoInstanceId("m1"))
    expect(result.showFallback).toBe(true)
  })

  it("key 空、有非任译喵可选、选中非任译喵：不 fallback", () => {
    const all = [renyimiao("m1"), other("microsoft")]
    const result = computeRenyimiaoGating(all, "", "microsoft")
    expect(result.showFallback).toBe(false)
    expect(result.providers.map((p) => p.id)).toEqual(["microsoft"])
  })
})
