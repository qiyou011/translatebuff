import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { providerConfigItemSchema } from "@/types/config/provider"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  buildRenyimiaoProvider,
  computeForkConfigSync,
  RENYIMIAO_MODELS,
  renyimiaoInstanceId,
} from "../renyimiao"

const DEEPSEEK = RENYIMIAO_MODELS.find((model) => model.modelId === "Deepseek-V4-Flash")!
const RENYIMIAO_DEEPSEEK_ID = renyimiaoInstanceId("Deepseek-V4-Flash")

function applyPatch(config: Config, patch: Partial<Config>): Config {
  return mergeWithArrayOverwrite(config, patch)
}

describe("buildRenyimiaoProvider", () => {
  it("产物能通过上游 provider schema 校验", () => {
    expect(providerConfigItemSchema.safeParse(buildRenyimiaoProvider(DEEPSEEK)).success).toBe(true)
  })

  it("缺 model:use-custom-model 时 schema 校验失败", () => {
    const broken = {
      ...buildRenyimiaoProvider(DEEPSEEK),
      model: { isCustomModel: true, customModel: DEEPSEEK.modelId },
    }
    expect(providerConfigItemSchema.safeParse(broken).success).toBe(false)
  })

  it("id 按模型派生、customModel 为大小写敏感的网关别名", () => {
    const provider = buildRenyimiaoProvider(DEEPSEEK)
    expect(provider.id).toBe(RENYIMIAO_DEEPSEEK_ID)
    expect(provider.model.customModel).toBe("Deepseek-V4-Flash")
  })
})

describe("computeForkConfigSync", () => {
  it("默认配置：隐藏 OpenAI/DeepSeek/Atlas、补齐任译喵实例", () => {
    const patch = computeForkConfigSync(DEFAULT_CONFIG)
    expect(patch).not.toBeNull()
    const ids = patch!.providersConfig!.map((provider) => provider.id)
    expect(ids).not.toContain("openai-default")
    expect(ids).not.toContain("deepseek-default")
    expect(ids).not.toContain("atlascloud-default")
    expect(ids).toContain("microsoft-translate-default")
    expect(ids).toContain(RENYIMIAO_DEEPSEEK_ID)
  })

  it("默认翻译源为微软（保留），不产生悬空重定向", () => {
    const patch = computeForkConfigSync(DEFAULT_CONFIG)
    expect(patch!.translate).toBeUndefined()
  })

  it("功能指向被隐藏 provider 时，兜底到微软翻译", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      translate: { ...DEFAULT_CONFIG.translate, providerId: "openai-default" },
    }
    const patch = computeForkConfigSync(config)
    expect(patch!.translate?.providerId).toBe("microsoft-translate-default")
  })

  it("同步后再次运行返回 null（幂等）", () => {
    const patch = computeForkConfigSync(DEFAULT_CONFIG)
    const synced = applyPatch(DEFAULT_CONFIG, patch!)
    expect(computeForkConfigSync(synced)).toBeNull()
  })

  it("保留已存在任译喵实例的 apiKey，不覆盖", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      providersConfig: [
        ...DEFAULT_CONFIG.providersConfig,
        { ...buildRenyimiaoProvider(DEEPSEEK), apiKey: "user-key" },
      ],
    }
    const patch = computeForkConfigSync(config)
    const kept = patch!.providersConfig!.find((provider) => provider.id === RENYIMIAO_DEEPSEEK_ID)
    expect(kept && "apiKey" in kept ? kept.apiKey : undefined).toBe("user-key")
  })
})
