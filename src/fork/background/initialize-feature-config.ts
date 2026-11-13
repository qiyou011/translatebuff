import type {
  FeatureConfigPatch,
  FeatureConfigPatchResult,
  FeatureConfigSnapshot,
  FeatureConfigReplacement,
} from "../config/types"
import type { Config } from "@/types/config/config"
import { deepmergeCustom } from "deepmerge-ts"
import { dequal } from "dequal"
import { z } from "zod"
import { storage } from "#imports"
import { configSchema } from "@/types/config/config"
import { Sha256Hex } from "@/utils/hash"
import { prepareImportedFeatureConfig } from "../config/backup"
import { migrateFeatureConfig } from "../config/migration"
import { forkConfigSchema } from "../config/schema"

export const FEATURE_CONFIG_JOURNAL_KEY = "local:fork:feature-config-transaction" as const
const pairSchema = z.object({ mainConfig: configSchema, forkConfig: forkConfigSchema })
const merge = deepmergeCustom({ mergeArrays: (values) => values[values.length - 1] })

/** 唯一后台写入口；读请求同样排队，恢复完成前不发布配置。 */
export function createFeatureConfigStore(initializeMain: () => Promise<unknown>) {
  let queue = Promise.resolve<unknown>(undefined)
  let initialized = false

  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const task = queue.then(operation)
    queue = task.catch(() => {})
    return task
  }

  async function readPair() {
    return {
      mainConfig: configSchema.parse(await storage.getItem("local:config")),
      forkConfig: await storage.getItem("local:forkConfig"),
    }
  }

  async function persist(pair: z.infer<typeof pairSchema>) {
    const checked = pairSchema.parse(pair)
    await storage.setItem(FEATURE_CONFIG_JOURNAL_KEY, checked)
    await storage.setItems([
      { key: "local:config", value: checked.mainConfig },
      { key: "local:forkConfig", value: checked.forkConfig },
    ])
    await storage.removeItem(FEATURE_CONFIG_JOURNAL_KEY)
  }

  async function prepare() {
    if (!initialized) await initializeMain()
    const journal = await storage.getItem(FEATURE_CONFIG_JOURNAL_KEY)
    if (journal) await persist(pairSchema.parse(journal))
    if (!initialized) {
      const current = await readPair()
      const migrated = migrateFeatureConfig(current.mainConfig, current.forkConfig)
      if (!dequal(current, migrated)) await persist(migrated)
      initialized = true
    }
  }

  async function snapshot(): Promise<FeatureConfigSnapshot> {
    // A second read detects external main-config writers while assembling the pair.
    for (let attempt = 0; attempt < 5; attempt++) {
      const first = pairSchema.parse(await readPair())
      const second = pairSchema.parse(await readPair())
      if (dequal(first, second)) {
        return { ...second, revision: Sha256Hex(JSON.stringify(second)) }
      }
    }
    throw new Error("Feature configuration is changing; retry the read")
  }

  return {
    updateMain: (update: (current: Config) => Config) =>
      serial(async () => {
        await prepare()
        const current = await snapshot()
        const mainConfig = configSchema.parse(update(structuredClone(current.mainConfig)))
        await persist({
          mainConfig,
          forkConfig: { ...current.forkConfig, revision: current.forkConfig.revision + 1 },
        })
        return snapshot()
      }),
    replace: (replacement: FeatureConfigReplacement): Promise<FeatureConfigPatchResult> =>
      serial(async () => {
        await prepare()
        const current = await snapshot()
        if (current.revision !== replacement.expectedRevision)
          return { ok: false, snapshot: current }
        await persist(
          prepareImportedFeatureConfig(replacement.mainConfig, replacement.forkConfig, current),
        )
        return { ok: true, snapshot: await snapshot() }
      }),
    read: () =>
      serial(async () => {
        await prepare()
        return snapshot()
      }),
    patch: (patch: FeatureConfigPatch): Promise<FeatureConfigPatchResult> =>
      serial(async () => {
        await prepare()
        const current = await snapshot()
        if (current.revision !== patch.expectedRevision) return { ok: false, snapshot: current }
        const next = pairSchema.parse({
          mainConfig: merge(current.mainConfig, patch.main ?? {}),
          forkConfig: merge(current.forkConfig, patch.fork ?? {}, {
            revision: current.forkConfig.revision + 1,
          }),
        })
        if (
          next.mainConfig.inputTranslation.toLang === "sourceCode" ||
          next.mainConfig.inputTranslation.toLang === "targetCode"
        ) {
          throw new Error("Input translation requires a concrete target language")
        }
        next.mainConfig.inputTranslation.enableCycle = false
        await persist(next)
        return { ok: true, snapshot: await snapshot() }
      }),
  }
}
