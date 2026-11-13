import { beforeEach, describe, expect, it } from "vitest"
import { storage } from "#imports"
import { createFeatureConfigStore } from "@/fork/background/initialize-feature-config"
import { DEFAULT_CONFIG, CONFIG_SCHEMA_VERSION } from "@/utils/constants/config"
import { createFeatureBackup, prepareImportedFeatureConfig } from "../backup"
import { migrateFeatureConfig } from "../migration"

describe("feature configuration backups", () => {
  beforeEach(async () => {
    await storage.clear("local")
  })

  it("round-trips all feature settings but never exports membership state", () => {
    const pair = {
      ...migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined),
      revision: "test",
    }
    pair.forkConfig.inputTranslation.triggerCount = 5
    pair.forkConfig.translationTextColor = "#123456"
    pair.forkConfig.featureLanguages.subtitles.targetCode = "fra"
    pair.forkConfig.membership.tier = "pro"
    const backup = createFeatureBackup(pair)
    expect(backup.schemaVersion).toBe(CONFIG_SCHEMA_VERSION)
    expect(backup.forkConfig).not.toHaveProperty("membership")
    const restored = prepareImportedFeatureConfig(backup.config, backup.forkConfig, pair)
    expect(restored.forkConfig.inputTranslation.triggerCount).toBe(5)
    expect(restored.forkConfig.featureLanguages.subtitles.targetCode).toBe("fra")
    expect(restored.forkConfig.translationTextColor).toBe("#123456")
  })

  it("migrates old-format backups from imported page language, without restoring supplied membership", () => {
    const current = {
      ...migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined),
      revision: "test",
    }
    const imported = structuredClone(DEFAULT_CONFIG)
    imported.language.targetCode = "deu"
    const next = prepareImportedFeatureConfig(imported, undefined, current)
    expect(next.forkConfig.featureLanguages.selection.targetCode).toBe("deu")
    expect(next.forkConfig.inputTranslation.triggerCount).toBe(2)
    const malicious = { ...next.forkConfig, membership: { tier: "pro" }, token: "not-auth" }
    expect(
      prepareImportedFeatureConfig(imported, malicious, current).forkConfig.membership.tier,
    ).toBe("free")
  })

  it("rejects malformed colors before writing and restores both configuration stores together", async () => {
    const service = createFeatureConfigStore(async () => {
      await storage.setItem("local:config", structuredClone(DEFAULT_CONFIG))
    })
    const before = await service.read()
    const config = structuredClone(before.mainConfig)
    config.inputTranslation.toLang = "fra"
    await expect(
      service.replace({
        expectedRevision: before.revision,
        mainConfig: config,
        forkConfig: { ...before.forkConfig, translationTextColor: "red;display:none" },
      }),
    ).rejects.toThrow(/Invalid/)
    expect((await service.read()).revision).toBe(before.revision)
    const changed = await service.replace({
      expectedRevision: before.revision,
      mainConfig: config,
      forkConfig: { ...before.forkConfig, inputTranslation: { triggerCount: 4 } },
    })
    expect(changed.ok).toBe(true)
    expect(changed.snapshot.mainConfig.inputTranslation.toLang).toBe("fra")
    expect(changed.snapshot.forkConfig.inputTranslation.triggerCount).toBe(4)
    expect(
      (await service.replace({ expectedRevision: before.revision, mainConfig: before.mainConfig }))
        .ok,
    ).toBe(false)
  })
})
