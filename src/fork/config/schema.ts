import { langCodeISO6393Schema } from "@read-frog/definitions"
import { z } from "zod"
import { FORK_CONFIG_SCHEMA_VERSION } from "./constants"

export const featureLanguageSchema = z.object({
  sourceCode: langCodeISO6393Schema.or(z.literal("auto")),
  targetCode: langCodeISO6393Schema,
})

const defaultLanguage = { sourceCode: "auto", targetCode: "eng" } as const

// 仅保存 fork 拥有的字段，provider 与输入目标仍由主配置持有。
export const forkConfigSchema = z.object({
  schemaVersion: z.number().int().default(FORK_CONFIG_SCHEMA_VERSION),
  revision: z.number().int().nonnegative().default(0),
  featureLanguages: z
    .object({
      selection: featureLanguageSchema.default(defaultLanguage),
      subtitles: featureLanguageSchema.default(defaultLanguage),
    })
    .default({ selection: defaultLanguage, subtitles: defaultLanguage }),
  inputTranslation: z
    .object({
      triggerCount: z.number().int().min(2).max(5).default(2),
    })
    .default({ triggerCount: 2 }),
  translationTextColor: z
    .string()
    .regex(/^#[\da-f]{6}$/i)
    .nullable()
    .default(null),
  translationPresetColors: z
    .partialRecord(
      z.enum(["weakened", "blockquote", "dashedLine", "border", "background"]),
      z.string().regex(/^#[\da-f]{6}$/i),
    )
    .default({}),
  membership: z
    .object({
      tier: z.enum(["free", "pro"]).default("free"),
    })
    .default({ tier: "free" }),
})

export type ForkConfig = z.infer<typeof forkConfigSchema>

export const DEFAULT_FORK_CONFIG: ForkConfig = forkConfigSchema.parse({})
