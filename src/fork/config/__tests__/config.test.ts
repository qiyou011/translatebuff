import { describe, expect, it } from "vitest"
import { migrateForkConfig } from "../migration"
import { DEFAULT_FORK_CONFIG, forkConfigSchema } from "../schema"

describe("fork config", () => {
  it("默认值满足 schema", () => {
    expect(() => forkConfigSchema.parse(DEFAULT_FORK_CONFIG)).not.toThrow()
  })

  it("把旧配置迁移到当前版本并补齐默认值", () => {
    const migrated = migrateForkConfig({})
    expect(forkConfigSchema.parse(migrated)).toEqual(migrated)
  })
})
