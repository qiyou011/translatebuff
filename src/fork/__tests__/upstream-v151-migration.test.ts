import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, posix, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Script } from "node:vm"
import * as apiContract from "@read-frog/api-contract"
import * as definitions from "@read-frog/definitions"
import { beforeEach, describe, expect, it } from "vitest"
import { browser, storage } from "#imports"
import { configSchema } from "@/types/config/config"
import { getAllBackupsWithMetadata } from "@/utils/backup/storage"
import { initializeConfig } from "@/utils/config/init"
import { migrateConfig } from "@/utils/config/migration"
import { setLocalConfigAndMeta } from "@/utils/config/storage"
import { CONFIG_SCHEMA_VERSION } from "@/utils/constants/config"
import { getDetectedCodeStateKey, getTranslationStateKey } from "@/utils/constants/storage-keys"
import * as i18nFacade from "@/utils/i18n"
import { logger } from "@/utils/logger"
import fixture from "./fixtures/upstream-v146-config.json"

const BASE = "4be99b341a7c940a48794232f066db43339cc2d2"
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const require = createRequire(import.meta.url)
// WXT already depends on esbuild. Use its installed copy without adding a
// dependency or maintaining a second legacy schema/migration implementation.
const { transformSync } = createRequire(require.resolve("wxt"))("esbuild")
const hasBaseline = (() => {
  try {
    execFileSync("git", ["cat-file", "-e", `${BASE}:src/types/config/config.ts`], {
      cwd: ROOT,
      stdio: "ignore",
    })
    return true
  } catch {
    return false
  }
})()
if (!hasBaseline) {
  process.stderr.write(
    `Legacy migration checks skipped: missing baseline Git object ${BASE}; fetch full history to run the four old-source checks. The fixture-only target migration still runs.\n`,
  )
}
const legacyPaths = new Set(
  hasBaseline
    ? execFileSync("git", ["ls-tree", "-r", "--name-only", BASE], { cwd: ROOT, encoding: "utf8" })
        .trim()
        .split("\n")
    : [],
)
const legacyModules = new Map<string, { exports: any }>()
function legacySource(path: string): string {
  return execFileSync("git", ["show", `${BASE}:${path}`], { cwd: ROOT, encoding: "utf8" })
}

/** Execute pinned, unmodified repository modules; only UI assets/i18n/logging
 * and the external browser storage boundary use this test runtime's adapters.
 * `import.meta.glob` is expanded from the pinned Git tree, just as Vite expands
 * the production registry. No test-owned schema or migration rules exist here.
 */
function legacyModule(path: string): any {
  const cached = legacyModules.get(path)
  if (cached) return cached.exports
  const module = { exports: {} }
  legacyModules.set(path, module)
  if (path.endsWith(".json")) {
    module.exports = JSON.parse(legacySource(path))
    return module.exports
  }
  const legacyRequire = (specifier: string) => {
    if (specifier === "#imports") return { storage, browser }
    if (specifier === "@read-frog/api-contract") return apiContract
    if (specifier === "@read-frog/definitions") return definitions
    if (specifier === "@/utils/i18n") return i18nFacade
    if (specifier === "@/utils/logger") return { logger }
    if (specifier.includes("?url")) return { __esModule: true, default: "legacy-ui-asset" }
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return require(specifier)
    const stem = specifier.startsWith("@/")
      ? `src/${specifier.slice(2)}`
      : posix.join(posix.dirname(path), specifier)
    const resolved = [stem, `${stem}.ts`, `${stem}.tsx`, `${stem}.json`, `${stem}/index.ts`].find(
      (candidate) => legacyPaths.has(candidate),
    )
    if (!resolved) throw new Error(`Missing pinned module ${path} -> ${specifier}`)
    return legacyModule(resolved)
  }
  const legacyGlob = () =>
    Object.fromEntries(
      [...legacyPaths]
        .filter((candidate) =>
          /^src\/utils\/config\/migration-scripts\/v\d+-to-v\d+\.ts$/.test(candidate),
        )
        .map((candidate) => [
          `./migration-scripts/${candidate.split("/").at(-1)}`,
          legacyModule(candidate).migrate,
        ]),
    )
  const { code } = transformSync(legacySource(path), {
    loader: "ts",
    format: "cjs",
    target: "es2022",
    define: {
      "import.meta.glob": "__legacyGlob",
      "import.meta.env": JSON.stringify({
        DEV: false,
        MODE: "test",
        WXT_SKIP_ENV_VALIDATION: "true",
      }),
    },
  })
  // Trusted source pinned to BASE, not imported user data.
  const evaluate = new Script(`(function(require, module, exports, __legacyGlob) {\n${code}\n})`, {
    filename: `legacy:${path}`,
  }).runInThisContext()
  evaluate(legacyRequire, module, module.exports, legacyGlob)
  return module.exports
}

const legacySchema = hasBaseline
  ? legacyModule("src/types/config/config.ts").configSchema
  : undefined
const legacyVersion = hasBaseline ? legacyModule("package.json").version : undefined
const legacyBackup = hasBaseline ? legacyModule("src/utils/backup/storage.ts") : undefined

function scenario() {
  const config: any = structuredClone(fixture.config)
  config.providersConfig.push({
    id: "renyimiao-migration-test",
    name: "Synthetic user provider",
    enabled: true,
    provider: "openai-compatible",
    apiKey: "TEST_ONLY_PROVIDER_KEY",
    baseURL: "https://migration-provider.invalid/v1",
    model: { model: "use-custom-model", isCustomModel: true, customModel: "migration-test-model" },
  })
  config.pageTranslation.providerId = "renyimiao-migration-test"
  config.pageTranslation.mode = "translationOnly"
  // A forward-written boolean must survive v108->v109 even with v100 metadata.
  // It was not part of the baseline v100 schema and is not claimed as its default.
  config.pageTranslation.page.translateTitle = false
  config.pageTranslation.batchQueueConfig = { maxItemsPerBatch: 16, maxCharactersPerBatch: 4000 }
  config.selectionToolbar.customActions[0] = {
    ...config.selectionToolbar.customActions[0],
    id: "user-action-preserved",
    name: "Synthetic user action",
    providerId: "renyimiao-migration-test",
  }
  config.inputTranslation = {
    ...config.inputTranslation,
    providerId: "renyimiao-migration-test",
    enabled: true,
    fromLang: "sourceCode",
    toLang: "cmn",
    enableCycle: true,
    timeThreshold: 450,
  }
  config.selectionToolbar.disabledSelectionToolbarPatterns = ["web.telegram.org", "discord.com"]
  config.siteControl = {
    mode: "whitelist",
    blacklistPatterns: [],
    whitelistPatterns: ["web.telegram.org", "discord.com"],
  }
  config.betaExperience.enabled = true
  return config
}

const independentState = [
  { key: "local:forkConfig" as const, value: { schemaVersion: 1, membership: { tier: "pro" } } },
  {
    key: "local:forkSession" as const,
    value: {
      schemaVersion: 1,
      loginCredential: "TEST_ONLY_CREDENTIAL",
      phone: "TEST_ONLY_PHONE",
      email: "",
      user: { id: "test" },
    },
  },
  {
    key: "local:forkMembershipInfo" as const,
    value: { tier: "pro", expiryDate: "2099-01-01", remainQuota: 12345 },
  },
  { key: getDetectedCodeStateKey(901), value: "jpn" },
  {
    key: getTranslationStateKey(901),
    value: {
      enabled: false,
      userDisabled: true,
      origin: "https://web.telegram.org",
    },
  },
  { key: getDetectedCodeStateKey(902), value: "eng" },
  {
    key: getTranslationStateKey(902),
    value: {
      enabled: false,
      userDisabled: true,
      origin: "https://discord.com",
    },
  },
]
async function expectIndependentState() {
  for (const { key, value } of independentState) expect(await storage.getItem(key)).toEqual(value)
}
async function backupBeforeUpgrade() {
  const config = scenario()
  expect(legacySchema.safeParse(config).success).toBe(true)
  await storage.setItem("local:config", config)
  await storage.setMeta("local:config", { schemaVersion: 100, lastModifiedAt: 1000 })
  for (const { key, value } of independentState) await storage.setItem(key, value)
  // Run the actual baseline backup helper BEFORE any target migration.
  await legacyBackup.addBackup(config, legacyVersion)
  const [backup] = await getAllBackupsWithMetadata()
  expect(backup?.schemaVersion).toBe(100)
  expect(backup?.config).toEqual(config)
  expect(backup?.metadata.extensionVersion).toBe(legacyVersion)
  expect((await storage.getMeta("local:config"))?.schemaVersion).toBe(100)
  return { config, backup: backup! }
}

beforeEach(async () => {
  await storage.clear("local")
  await storage.clear("session")
})

it("migrates the frozen v100 fixture and user overrides to v111 without requiring Git history", async () => {
  const before = scenario()
  const after = await migrateConfig(before, fixture.schemaVersion)
  expect(configSchema.safeParse(after).success).toBe(true)
  expect(after.pageTranslation.page.translateTitle).toBe(false)
  expect(after.pageTranslation.mode).toBe("translationOnly")
  expect(after.inputTranslation).toEqual(before.inputTranslation)
  expect(
    after.providersConfig.find((provider) => provider.id === "renyimiao-migration-test"),
  ).toEqual(before.providersConfig.at(-1))
  expect(after.selectionToolbar.customActions[0]?.id).toBe("user-action-preserved")
})

// Old-source checks need the pinned history. The fixture-only target migration
// above always runs in shallow CI; full-history fork-guard runs this group too.
describe.skipIf(!hasBaseline)(
  "pinned v100 to v111 config migration and storage-level restore (requires baseline Git object)",
  () => {
    it("uses the exact baseline frozen fixture and real baseline v100 validator", () => {
      const frozen = legacyModule("src/utils/config/__tests__/example/v100.ts").testSeries[
        "prompt-token-migration-coverage"
      ].config
      expect(fixture).toEqual({ schemaVersion: 100, config: frozen })
      expect(legacyModule("src/utils/constants/config.ts").CONFIG_SCHEMA_VERSION).toBe(100)
      expect(CONFIG_SCHEMA_VERSION).toBe(111)
      expect(legacySchema.safeParse(fixture.config).success).toBe(true)
    })

    it("backs up first, upgrades storage to v111, and preserves user and independent site/member state", async () => {
      const { config: before, backup } = await backupBeforeUpgrade()
      expect(await initializeConfig()).toEqual({ isFreshInstall: false })
      const after: any = await storage.getItem("local:config")
      expect(configSchema.safeParse(after).success).toBe(true)
      expect((await storage.getMeta("local:config"))?.schemaVersion).toBe(111)
      expect((await storage.getMeta("local:config"))?.lastModifiedAt).toBe(1000)
      expect(
        after.providersConfig.find((provider: any) => provider.id === "renyimiao-migration-test"),
      ).toEqual(before.providersConfig.at(-1))
      expect(after.providersConfig.map((provider: any) => provider.id)).toEqual(
        before.providersConfig.map((provider: any) => provider.id),
      )
      expect(after.pageTranslation.providerId).toBe("renyimiao-migration-test")
      expect(after.pageTranslation.mode).toBe("translationOnly")
      expect(after.pageTranslation.page.translateTitle).toBe(false)
      expect(after.pageTranslation.batchQueueConfig).toEqual({
        maxItemsPerBatch: 16,
        maxCharactersPerBatch: 4000,
      })
      const action = after.selectionToolbar.customActions.find(
        (entry: any) => entry.id === "user-action-preserved",
      )
      expect(action).toMatchObject({
        name: before.selectionToolbar.customActions[0].name,
        providerId: "renyimiao-migration-test",
        prompt: before.selectionToolbar.customActions[0].prompt,
        systemPrompt: before.selectionToolbar.customActions[0].systemPrompt,
      })
      expect(action.outputSchema.map((field: any) => field.id)).toEqual(
        before.selectionToolbar.customActions[0].outputSchema.map((field: any) => field.id),
      )
      expect(after.inputTranslation).toEqual(before.inputTranslation)
      expect(after.siteControl).toEqual({
        mode: "whitelist",
        blacklistPatterns: [],
        whitelistPatterns: ["*.web.telegram.org", "*.discord.com"],
      })
      expect(after.selectionToolbar.disabledSelectionToolbarPatterns).toEqual([
        "*.web.telegram.org",
        "*.discord.com",
      ])
      expect(await storage.getItem(`local:${backup.id}`)).toEqual({
        schemaVersion: 100,
        config: before,
      })
      await expectIndependentState()
    })

    it("imports the saved schema100 envelope through target migrateConfig and config storage helpers", async () => {
      const { config: before, backup } = await backupBeforeUpgrade()
      await initializeConfig()
      const exported = JSON.parse(
        JSON.stringify({ schemaVersion: backup.schemaVersion, config: backup.config }),
      )
      const imported = await migrateConfig(exported.config, exported.schemaVersion)
      await setLocalConfigAndMeta(imported, { schemaVersion: 111, lastModifiedAt: 2000 })
      const current: any = await storage.getItem("local:config")
      expect(current).toEqual(imported)
      expect(current.pageTranslation.page.translateTitle).toBe(false)
      expect(current.inputTranslation).toEqual(before.inputTranslation)
      expect(current.selectionToolbar.customActions[0].providerId).toBe("renyimiao-migration-test")
      expect((await storage.getMeta("local:config"))?.schemaVersion).toBe(111)
      await expectIndependentState()
    })

    it("restores the saved backup with actual old helpers and passes old schema validation before downgrade", async () => {
      const { config: before, backup } = await backupBeforeUpgrade()
      await initializeConfig()
      const upgraded = await storage.getItem("local:config")
      const oldMigration = legacyModule("src/utils/config/migration.ts")
      const oldErrors = legacyModule("src/utils/config/errors.ts")
      await expect(oldMigration.migrateConfig(upgraded, 111)).rejects.toBeInstanceOf(
        oldErrors.ConfigVersionTooNewError,
      )
      const restored = await oldMigration.migrateConfig(
        structuredClone(backup.config),
        backup.schemaVersion,
      )
      const oldStorage = legacyModule("src/utils/config/storage.ts")
      await oldStorage.setLocalConfigAndMeta(restored, { schemaVersion: 100, lastModifiedAt: 1000 })
      const actual: any = await storage.getItem("local:config")
      expect(actual).toEqual(legacySchema.parse(before))
      expect(legacySchema.safeParse(actual).success).toBe(true)
      expect(actual.providersConfig.at(-1).apiKey).toBe("TEST_ONLY_PROVIDER_KEY")
      expect(actual.selectionToolbar.customActions[0].id).toBe("user-action-preserved")
      expect(actual.siteControl.whitelistPatterns).toEqual(["web.telegram.org", "discord.com"])
      expect(actual.pageTranslation.mode).toBe("translationOnly")
      expect((await storage.getMeta("local:config"))?.schemaVersion).toBe(100)
      await expectIndependentState()
    })
  },
)
