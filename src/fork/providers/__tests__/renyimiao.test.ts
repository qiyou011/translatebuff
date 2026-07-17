import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { providerConfigItemSchema } from "@/types/config/provider"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  buildRenyimiaoProvider,
  computeForkConfigSync,
  isForkVisibleProvider,
  renyimiaoApiKey,
  renyimiaoInstanceId,
  renyimiaoModelIds,
  setRenyimiaoApiKey,
  syncRenyimiaoModels,
} from "../renyimiao"

const DEEPSEEK_ID = renyimiaoInstanceId("Deepseek-V4-Flash")

// 从默认配置取真实 provider 作 fixture（默认 5 个：microsoft/google/openai/deepseek/atlascloud）。
function defaultProvider(providerType: string) {
  const provider = DEFAULT_CONFIG.providersConfig.find((item) => item.provider === providerType)
  if (!provider) {
    throw new Error(`默认配置缺 provider：${providerType}`)
  }
  return provider
}

function applyPatch(config: Config, patch: Partial<Config>): Config {
  return mergeWithArrayOverwrite(config, patch)
}

describe("buildRenyimiaoProvider（每模型一份实例）", () => {
  it("产物能通过上游 provider schema 校验", () => {
    expect(
      providerConfigItemSchema.safeParse(buildRenyimiaoProvider("Deepseek-V4-Flash")).success,
    ).toBe(true)
  })

  it("id 按模型派生、customModel 为大小写敏感的网关别名、name 带任译喵、可注入共享 key", () => {
    const provider = buildRenyimiaoProvider("GLM-5.2", "shared-key")
    expect(provider.id).toBe(renyimiaoInstanceId("GLM-5.2"))
    expect(provider.model.customModel).toBe("GLM-5.2")
    expect(provider.name).toContain("任译喵")
    expect(provider.apiKey).toBe("shared-key")
  })
})

describe("isForkVisibleProvider（fork UI 可见性谓词）", () => {
  it("放行任译喵实例", () => {
    expect(isForkVisibleProvider(buildRenyimiaoProvider("GLM-5.2"))).toBe(true)
  })

  it("放行纯翻译 provider（microsoft / google）", () => {
    expect(isForkVisibleProvider(defaultProvider("microsoft-translate"))).toBe(true)
    expect(isForkVisibleProvider(defaultProvider("google-translate"))).toBe(true)
  })

  it("拦截默认大语言模型 provider（openai / deepseek / atlascloud）", () => {
    expect(isForkVisibleProvider(defaultProvider("openai"))).toBe(false)
    expect(isForkVisibleProvider(defaultProvider("deepseek"))).toBe(false)
    expect(isForkVisibleProvider(defaultProvider("atlascloud"))).toBe(false)
  })
})

describe("computeForkConfigSync（seed 内置可用模型 + repoint）", () => {
  it("seed 内置可用模型（Deepseek-V4-Flash）、保留默认 provider", () => {
    const patch = computeForkConfigSync(DEFAULT_CONFIG)
    expect(patch).not.toBeNull()
    const ids = patch!.providersConfig!.map((provider) => provider.id)
    expect(ids).toContain(DEEPSEEK_ID)
    expect(ids).toContain("openai-default")
    expect(ids).toContain("microsoft-translate-default")
  })

  it("指向免费AI的自定义动作（词典）repoint 到任译喵实例", () => {
    const patch = computeForkConfigSync(DEFAULT_CONFIG)
    const actions = patch!.selectionToolbar?.customActions
    expect(actions!.some((action) => action.providerId === "read-frog-free-ai")).toBe(false)
    expect(actions!.some((action) => action.providerId === DEEPSEEK_ID)).toBe(true)
  })

  it("同步后再次运行返回 null（幂等）", () => {
    const patch = computeForkConfigSync(DEFAULT_CONFIG)
    const synced = applyPatch(DEFAULT_CONFIG, patch!)
    expect(computeForkConfigSync(synced)).toBeNull()
  })
})

describe("syncRenyimiaoModels（以 fetch 结果为准重建实例集）", () => {
  function seededConfig(): Config {
    return applyPatch(DEFAULT_CONFIG, computeForkConfigSync(DEFAULT_CONFIG)!)
  }

  it("按 modelIds 重建任译喵实例集，非任译喵 provider 保留", () => {
    const config = seededConfig()
    const patch = syncRenyimiaoModels(config, ["Deepseek-V4-Pro", "GLM-5.2", "Kimi-k2.7"])
    const next = applyPatch(config, patch)
    expect(renyimiaoModelIds(next.providersConfig).sort()).toEqual(
      ["Deepseek-V4-Pro", "GLM-5.2", "Kimi-k2.7"].sort(),
    )
    expect(next.providersConfig.some((provider) => provider.id === "openai-default")).toBe(true)
  })

  it("保留共享 apiKey：新实例带上已配置的 key", () => {
    const withKey = applyPatch(seededConfig(), {
      providersConfig: setRenyimiaoApiKey(seededConfig().providersConfig, "user-key"),
    })
    const patch = syncRenyimiaoModels(withKey, ["GLM-5.2"])
    const next = applyPatch(withKey, patch)
    const glm = next.providersConfig.find(
      (provider) => provider.id === renyimiaoInstanceId("GLM-5.2"),
    )
    expect(glm && "apiKey" in glm ? glm.apiKey : undefined).toBe("user-key")
  })

  it("功能指向被移除的任译喵实例时 repoint 到存活实例", () => {
    const config: Config = {
      ...seededConfig(),
      translate: { ...DEFAULT_CONFIG.translate, providerId: DEEPSEEK_ID },
    }
    const patch = syncRenyimiaoModels(config, ["GLM-5.2"])
    const next = applyPatch(config, patch)
    expect(next.translate.providerId).toBe(renyimiaoInstanceId("GLM-5.2"))
  })
})

describe("共享 API Key 读写", () => {
  it("renyimiaoApiKey 读首个任译喵实例的 key；setRenyimiaoApiKey 广播到全部任译喵实例", () => {
    const config = applyPatch(DEFAULT_CONFIG, computeForkConfigSync(DEFAULT_CONFIG)!)
    const withModels = applyPatch(config, syncRenyimiaoModels(config, ["A-model", "B-model"]))
    const broadcast = setRenyimiaoApiKey(withModels.providersConfig, "k-123")
    const renyimiaoInstances = broadcast.filter((provider) => provider.id.startsWith("renyimiao-"))
    expect(renyimiaoInstances.length).toBe(2)
    expect(
      renyimiaoInstances.every((provider) => "apiKey" in provider && provider.apiKey === "k-123"),
    ).toBe(true)
    expect(renyimiaoApiKey(broadcast)).toBe("k-123")
    // 不动非任译喵 provider 的 key
    const openai = broadcast.find((provider) => provider.id === "openai-default")
    expect(openai && "apiKey" in openai ? openai.apiKey : undefined).not.toBe("k-123")
  })
})
