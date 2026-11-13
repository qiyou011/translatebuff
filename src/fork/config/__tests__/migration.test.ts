import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { FORK_CONFIG_SCHEMA_VERSION } from "../constants"
import { migrateFeatureConfig } from "../migration"

function mainConfig() {
  const config = structuredClone(DEFAULT_CONFIG)
  config.language = { ...config.language, sourceCode: "jpn", targetCode: "eng" }
  config.inputTranslation = {
    ...config.inputTranslation,
    toLang: "sourceCode",
    enableCycle: true,
    timeThreshold: 500,
  }
  return config
}

describe("1.7.0 feature configuration migration", () => {
  it.each([undefined, {}, { schemaVersion: 1, membership: { tier: "pro" } }])(
    "initializes missing and old fork data with the same feature rules: %j",
    (raw) => {
      const result = migrateFeatureConfig(mainConfig(), raw)
      expect(result.forkConfig.inputTranslation.triggerCount).toBe(2)
      expect(result.forkConfig.featureLanguages).toEqual({
        selection: { sourceCode: "jpn", targetCode: "eng" },
        subtitles: { sourceCode: "jpn", targetCode: "eng" },
      })
      expect(result.forkConfig.schemaVersion).toBe(FORK_CONFIG_SCHEMA_VERSION)
      expect(result.mainConfig.inputTranslation).toMatchObject({
        toLang: "eng",
        enableCycle: false,
        timeThreshold: 500,
      })
    },
  )

  it.each(["sourceCode", "targetCode"] as const)(
    "converts %s to the global target snapshot",
    (toLang) => {
      const main = mainConfig()
      main.inputTranslation.toLang = toLang
      expect(migrateFeatureConfig(main, undefined).mainConfig.inputTranslation.toLang).toBe("eng")
      expect(main.inputTranslation.toLang).toBe(toLang)
    },
  )

  it("preserves a concrete target and unrelated settings", () => {
    const main = mainConfig()
    main.inputTranslation.toLang = "fra"
    const result = migrateFeatureConfig(main, undefined)
    expect(result.mainConfig).toEqual({
      ...main,
      inputTranslation: { ...main.inputTranslation, enableCycle: false },
    })
  })

  it("keeps subsequent user choices on the second and later startup", () => {
    const first = migrateFeatureConfig(mainConfig(), undefined)
    first.forkConfig.inputTranslation.triggerCount = 5
    first.forkConfig.featureLanguages.selection.targetCode = "fra"
    first.forkConfig.translationTextColor = "#123456"
    first.forkConfig.revision = 7
    first.mainConfig.language.targetCode = "deu"
    const second = migrateFeatureConfig(first.mainConfig, first.forkConfig)
    expect(second).toEqual(first)
    expect(migrateFeatureConfig(second.mainConfig, second.forkConfig)).toEqual(second)
  })

  it("repairs invalid feature fields without discarding valid independent choices", () => {
    const first = migrateFeatureConfig(mainConfig(), undefined)
    const result = migrateFeatureConfig(first.mainConfig, {
      ...first.forkConfig,
      inputTranslation: { triggerCount: 9 },
      translationTextColor: "url(https://invalid.example/)",
      featureLanguages: {
        ...first.forkConfig.featureLanguages,
        selection: { sourceCode: "auto", targetCode: "fra" },
      },
    })
    expect(result.forkConfig.inputTranslation.triggerCount).toBe(2)
    expect(result.forkConfig.translationTextColor).toBeNull()
    expect(result.forkConfig.featureLanguages.selection.targetCode).toBe("fra")
  })
})
