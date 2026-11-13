import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { createFeatureConfigStore } from "@/fork/background/initialize-feature-config"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  createFeatureBackup,
  importFeatureConfig,
  prepareImportedFeatureConfig,
  resetFeatureConfig,
} from "../backup"

let service: ReturnType<typeof createFeatureConfigStore>
const backup = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<void>>())
vi.mock("@/utils/backup/storage", () => ({ addBackup: backup }))
vi.mock("@/fork/message", () => ({
  sendForkMessage: (name: string, data: never) => {
    if (name === "forkReadFeatureConfig") return service.read()
    if (name === "forkReplaceFeatureConfig") return service.replace(data)
    throw new Error(name)
  },
}))

beforeEach(async () => {
  await storage.clear("local")
  backup.mockReset().mockResolvedValue(undefined)
  service = createFeatureConfigStore(async () => {
    await storage.setItem("local:config", structuredClone(DEFAULT_CONFIG))
  })
})

describe("backup import and reset transactions", () => {
  it("restores both settings on related-data failure, retaining a safety backup", async () => {
    const before = await service.read()
    const imported = structuredClone(before.mainConfig)
    imported.inputTranslation.toLang = "fra"
    await expect(
      importFeatureConfig(imported, undefined, async () => {
        throw new Error("Glossary write failed")
      }),
    ).rejects.toThrow("Glossary write failed")
    const after = await service.read()
    expect(after.mainConfig).toEqual(before.mainConfig)
    expect(after.forkConfig.featureLanguages).toEqual(before.forkConfig.featureLanguages)
    expect(backup).toHaveBeenCalledOnce()
  })

  it("keeps concurrent settings instead of rolling an unrelated write back", async () => {
    const before = await service.read()
    await expect(
      importFeatureConfig(before.mainConfig, undefined, async () => {
        const current = await service.read()
        await service.patch({
          expectedRevision: current.revision,
          fork: { inputTranslation: { triggerCount: 5 } },
        })
        throw new Error("Related import failed")
      }),
    ).rejects.toThrow("newer settings prevented rollback")
    expect((await service.read()).forkConfig.inputTranslation.triggerCount).toBe(5)
  })

  it("fully resets feature choices and color while preserving membership identity", async () => {
    const before = await service.read()
    await service.patch({
      expectedRevision: before.revision,
      main: { inputTranslation: { toLang: "fra" } },
      fork: {
        translationTextColor: "#123456",
        translationPresetColors: { border: "#abcdef", background: "#dfeee4" },
        inputTranslation: { triggerCount: 5 },
        featureLanguages: { subtitles: { targetCode: "deu" } },
      },
    })
    const withMembership = await service.read()
    await storage.setItem("local:forkConfig", {
      ...withMembership.forkConfig,
      membership: { tier: "pro" },
    })
    await resetFeatureConfig()
    const after = await service.read()
    expect(after.forkConfig.membership.tier).toBe("pro")
    expect(after.forkConfig.inputTranslation.triggerCount).toBe(2)
    expect(after.forkConfig.translationTextColor).toBeNull()
    expect(after.forkConfig.translationPresetColors).toEqual({})
    expect(after.forkConfig.featureLanguages.subtitles.targetCode).toBe(
      after.mainConfig.language.targetCode,
    )
  })

  it("round-trips independent preset colors and accepts older backups", async () => {
    const current = await service.read()
    const colors = { weakened: "#123456", border: "#abcdef", background: "#dfeee4" }
    await service.patch({
      expectedRevision: current.revision,
      fork: { translationPresetColors: colors },
    })
    const saved = await service.read()
    const exported = createFeatureBackup(saved)
    expect(exported.forkConfig.translationPresetColors).toEqual(colors)
    const restored = prepareImportedFeatureConfig(exported.config, exported.forkConfig, saved)
    expect(restored.forkConfig.translationPresetColors).toEqual(colors)
    const { translationPresetColors: _, ...older } = exported.forkConfig
    expect(
      prepareImportedFeatureConfig(exported.config, older, saved).forkConfig
        .translationPresetColors,
    ).toEqual({})
    expect(() =>
      prepareImportedFeatureConfig(
        exported.config,
        { ...older, translationPresetColors: { border: "red; display:none" } },
        saved,
      ),
    ).toThrow(/Invalid/)
  })

  it("never exports or restores gateway credentials from a backup", async () => {
    const current = await service.read()
    current.mainConfig.providersConfig.push(
      buildRenyimiaoProvider("test-model", "active-session-key", "https://gateway.invalid/v1"),
    )
    const exported = createFeatureBackup(current)
    expect(JSON.stringify(exported)).not.toContain("active-session-key")
    const imported = structuredClone(current.mainConfig)
    const provider = imported.providersConfig.at(-1)!
    if ("apiKey" in provider) provider.apiKey = "old-account-key"
    const restored = prepareImportedFeatureConfig(imported, exported.forkConfig, current)
    expect(JSON.stringify(restored)).not.toContain("old-account-key")
    expect(JSON.stringify(restored)).toContain("active-session-key")
  })
})
