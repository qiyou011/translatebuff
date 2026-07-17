import { createStore } from "jotai"
import { describe, expect, it } from "vitest"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { selectedProviderIdsAtom } from "../atoms"

// fork 覆盖的选择状态：默认全选须剔除被隐藏的默认 LLM（截图右侧多接口卡片的泄漏源）。
describe("fork atoms · selectedProviderIdsAtom 默认值", () => {
  it("默认只选 fork 可见 provider：含 microsoft/google，剔除 openai/deepseek/atlascloud", () => {
    const ids = createStore().get(selectedProviderIdsAtom)
    expect(ids).toContain("microsoft-translate-default")
    expect(ids).toContain("google-translate-default")
    expect(ids).not.toContain("openai-default")
    expect(ids).not.toContain("deepseek-default")
    expect(ids).not.toContain("atlascloud-default")
  })

  it("默认含已 seed 的任译喵实例", () => {
    const store = createStore()
    const renyimiao = buildRenyimiaoProvider("GLM-5.2")
    store.set(configAtom, {
      ...DEFAULT_CONFIG,
      providersConfig: [...DEFAULT_CONFIG.providersConfig, renyimiao],
    })
    expect(store.get(selectedProviderIdsAtom)).toContain(renyimiao.id)
  })

  it("override（用户手选）后原样返回，不再过滤", () => {
    const store = createStore()
    store.set(selectedProviderIdsAtom, ["openai-default"])
    expect(store.get(selectedProviderIdsAtom)).toEqual(["openai-default"])
  })
})
