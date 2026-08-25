import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { providerConfigItemSchema } from "@/types/config/provider"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  buildRenyimiaoProvider,
  computeForkConfigSync,
  isForkVisibleProvider,
  normalizeGatewayBaseUrl,
  RENYIMIAO_GATEWAY_BASE_URL,
  renyimiaoApiKey,
  renyimiaoBaseUrl,
  renyimiaoInstanceId,
  renyimiaoModelIds,
  setRenyimiaoApiKey,
  setRenyimiaoBaseUrl,
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
    // 上游 v1.43.6 把内置词典从 customActions 挪进了 selectionToolbar.builtInActions.dictionary，
    // 默认仍指向 fork 里不可见的免费AI，所以 repoint 必须跟到新位置。
    const dictionary = patch!.selectionToolbar?.builtInActions?.dictionary
    expect(dictionary?.providerId).not.toBe("read-frog-free-ai")
    expect(dictionary?.providerId).toBe(DEEPSEEK_ID)
    const actions = patch!.selectionToolbar?.customActions ?? []
    expect(actions.some((action) => action.providerId === "read-frog-free-ai")).toBe(false)
  })

  it("同步后再次运行返回 null（幂等）", () => {
    const patch = computeForkConfigSync(DEFAULT_CONFIG)
    const synced = applyPatch(DEFAULT_CONFIG, patch!)
    expect(computeForkConfigSync(synced)).toBeNull()
  })

  it("已动态同步过实例后，seed 不再补静态模型（防静态残留污染动态列表）", () => {
    const seeded = applyPatch(DEFAULT_CONFIG, computeForkConfigSync(DEFAULT_CONFIG)!)
    // 模拟登录后 /v1/models 动态同步：换成一批全新 id，静态 Deepseek-V4-Flash 被移除
    const synced = applyPatch(seeded, syncRenyimiaoModels(seeded, ["dyn-model-a", "dyn-model-b"]))
    expect(renyimiaoModelIds(synced.providersConfig).sort()).toEqual(["dyn-model-a", "dyn-model-b"])
    // 再跑 seed：不得把静态 Deepseek-V4-Flash 加回来
    const patch = computeForkConfigSync(synced)
    const after = patch ? applyPatch(synced, patch) : synced
    expect(renyimiaoModelIds(after.providersConfig).sort()).toEqual(["dyn-model-a", "dyn-model-b"])
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

  it("划词工具栏翻译功能与自定义动作同时指向被移除实例：翻译 repoint 不被自定义动作补丁覆盖", () => {
    // seed 后词典自定义动作已指向 DEEPSEEK_ID；再让划词工具栏翻译功能也指向它 → 构造共现（两者同触发 repoint）。
    const seeded = seededConfig()
    const config: Config = {
      ...seeded,
      selectionToolbar: {
        ...seeded.selectionToolbar,
        features: {
          ...seeded.selectionToolbar.features,
          translate: { ...seeded.selectionToolbar.features.translate, providerId: DEEPSEEK_ID },
        },
      },
    }
    const survivor = renyimiaoInstanceId("GLM-5.2")
    const next = applyPatch(config, syncRenyimiaoModels(config, ["GLM-5.2"]))
    // 划词翻译 repoint 到存活实例（bug 时被 { ...config.selectionToolbar } 覆盖盖回被移除的 DEEPSEEK_ID）。
    expect(next.selectionToolbar.features.translate.providerId).toBe(survivor)
    // 共现的另一半：自定义动作也已 repoint，不再指向被移除实例。
    expect(
      next.selectionToolbar.customActions.every((action) => action.providerId !== DEEPSEEK_ID),
    ).toBe(true)
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

describe("normalizeGatewayBaseUrl（归一到含 /v1）", () => {
  it("不含 /v1 → 补 /v1", () => {
    expect(normalizeGatewayBaseUrl("https://gw.example.com")).toBe("https://gw.example.com/v1")
  })

  it("已含 /v1 → 幂等不重复补", () => {
    expect(normalizeGatewayBaseUrl("https://gw.example.com/v1")).toBe("https://gw.example.com/v1")
  })

  it("去尾斜杠后再补 /v1", () => {
    expect(normalizeGatewayBaseUrl("https://gw.example.com/")).toBe("https://gw.example.com/v1")
  })

  it("空串 → 回落网关常量", () => {
    expect(normalizeGatewayBaseUrl("")).toBe(RENYIMIAO_GATEWAY_BASE_URL)
  })
})

describe("共享网关 base_url 读写", () => {
  it("setRenyimiaoBaseUrl 广播归一后的 base_url 到全部任译喵实例；renyimiaoBaseUrl 读首个", () => {
    const config = applyPatch(DEFAULT_CONFIG, computeForkConfigSync(DEFAULT_CONFIG)!)
    const withModels = applyPatch(config, syncRenyimiaoModels(config, ["A-model", "B-model"]))
    const broadcast = setRenyimiaoBaseUrl(withModels.providersConfig, "https://dyn.gw")
    const instances = broadcast.filter((provider) => provider.id.startsWith("renyimiao-"))
    expect(instances.length).toBe(2)
    expect(
      instances.every(
        (provider) => "baseURL" in provider && provider.baseURL === "https://dyn.gw/v1",
      ),
    ).toBe(true)
    expect(renyimiaoBaseUrl(broadcast)).toBe("https://dyn.gw/v1")
    // 不动非任译喵 provider
    const openai = broadcast.find((provider) => provider.id === "openai-default")
    expect(openai && "baseURL" in openai ? openai.baseURL : undefined).not.toBe("https://dyn.gw/v1")
  })

  it("syncRenyimiaoModels 新建实例沿用已配置的共享 base_url", () => {
    const config = applyPatch(DEFAULT_CONFIG, computeForkConfigSync(DEFAULT_CONFIG)!)
    const withBase = applyPatch(config, {
      providersConfig: setRenyimiaoBaseUrl(config.providersConfig, "https://dyn.gw"),
    })
    const patch = syncRenyimiaoModels(withBase, ["New-Model"])
    const next = applyPatch(withBase, patch)
    const created = next.providersConfig.find(
      (provider) => provider.id === renyimiaoInstanceId("New-Model"),
    )
    expect(created && "baseURL" in created ? created.baseURL : undefined).toBe("https://dyn.gw/v1")
  })
})
