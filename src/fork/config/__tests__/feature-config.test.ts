import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { resolveFeatureConfig } from "../feature-config"
import { migrateFeatureConfig } from "../migration"

describe("translation feature snapshots", () => {
  it("keeps four language settings independent and reads providers from their existing owners", () => {
    const { mainConfig: main, forkConfig: fork } = migrateFeatureConfig(
      structuredClone(DEFAULT_CONFIG),
      undefined,
    )
    main.language = { ...main.language, sourceCode: "jpn", targetCode: "eng" }
    main.inputTranslation.toLang = "fra"
    fork.featureLanguages.selection = { sourceCode: "auto", targetCode: "deu" }
    fork.featureLanguages.subtitles = { sourceCode: "kor", targetCode: "spa" }
    expect(resolveFeatureConfig("page", main, fork)).toMatchObject({
      source: "jpn",
      target: "eng",
      providerId: main.pageTranslation.providerId,
    })
    expect(resolveFeatureConfig("selection", main, fork)).toMatchObject({
      source: "auto",
      target: "deu",
      providerId: main.selectionToolbar.features.translate.providerId,
    })
    expect(resolveFeatureConfig("subtitles", main, fork)).toMatchObject({
      source: "kor",
      target: "spa",
      providerId: main.videoSubtitles.providerId,
    })
    expect(resolveFeatureConfig("input", main, fork)).toMatchObject({
      source: "auto-draft",
      target: "fra",
      providerId: main.inputTranslation.providerId,
    })
  })

  it("disables context for ordinary providers and freezes a request's provider and target", () => {
    const { mainConfig: main, forkConfig: fork } = migrateFeatureConfig(
      structuredClone(DEFAULT_CONFIG),
      undefined,
    )
    main.pageTranslation.enableAIContentAware = true
    const snapshot = resolveFeatureConfig("input", main, fork)
    const saved = structuredClone(snapshot)
    main.inputTranslation.toLang = "fra"
    main.providersConfig.length = 0
    expect(snapshot).toEqual(saved)
    expect(snapshot.contextEnabled).toBe(false)
  })
})
