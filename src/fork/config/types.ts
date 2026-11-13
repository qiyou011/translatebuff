import type { ForkConfig } from "./schema"
import type { Config } from "@/types/config/config"

export interface FeatureConfigSnapshot {
  mainConfig: Config
  forkConfig: ForkConfig
  revision: string
}

export interface FeatureConfigPatch {
  expectedRevision: string
  fork?: {
    featureLanguages?: {
      [K in keyof ForkConfig["featureLanguages"]]?: Partial<ForkConfig["featureLanguages"][K]>
    }
    inputTranslation?: Partial<ForkConfig["inputTranslation"]>
    translationTextColor?: ForkConfig["translationTextColor"]
    translationPresetColors?: ForkConfig["translationPresetColors"]
  }
  main?: ConfigFieldPatch<Config>
}

export type ConfigFieldPatch<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: ConfigFieldPatch<T[K]> }
    : T

export interface FeatureConfigPatchResult {
  ok: boolean
  snapshot: FeatureConfigSnapshot
}

export interface FeatureConfigReplacement {
  expectedRevision: string
  mainConfig: Config
  forkConfig?: unknown
}
