import { defineConfig } from "vitest/config"
import forkConfig from "../../../../vitest.fork.config"

export default defineConfig({
  ...forkConfig,
  test: {
    ...forkConfig.test,
    include: ["openspec/changes/upstream-fixes-v1-6-1/evidence/alternative-acceptance.forktest.ts"],
    maxWorkers: 1,
  },
})
