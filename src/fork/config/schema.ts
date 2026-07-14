import { z } from "zod"
import { FORK_CONFIG_SCHEMA_VERSION } from "./constants"

// fork 专属设置（会员态、fork 特色开关等）。上游配置照旧走 upstream configSchema
export const forkConfigSchema = z.object({
  schemaVersion: z.number().default(FORK_CONFIG_SCHEMA_VERSION),
  membership: z
    .object({
      tier: z.enum(["free", "pro"]).default("free"),
    })
    .default({ tier: "free" }),
})

export type ForkConfig = z.infer<typeof forkConfigSchema>

export const DEFAULT_FORK_CONFIG: ForkConfig = forkConfigSchema.parse({})
