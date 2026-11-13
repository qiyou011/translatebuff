import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrateFeatureConfig } from "../migration"
import { projectSubtitleConfig } from "../subtitle-config"

describe("subtitle configuration projection", () => {
  it("isolates subtitle languages and provider parameters from later settings changes", () => {
    const pair = migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined)
    pair.mainConfig.language.targetCode = "jpn"
    pair.forkConfig.featureLanguages.subtitles = { sourceCode: "fra", targetCode: "deu" }
    const config = projectSubtitleConfig(pair)
    expect(config.language).toMatchObject({ sourceCode: "fra", targetCode: "deu" })
    expect(pair.mainConfig.language.targetCode).toBe("jpn")
    pair.mainConfig.providersConfig.length = 0
    pair.forkConfig.featureLanguages.subtitles.targetCode = "spa"
    expect(config.providersConfig.length).toBeGreaterThan(0)
    expect(config.language.targetCode).toBe("deu")
  })
})
