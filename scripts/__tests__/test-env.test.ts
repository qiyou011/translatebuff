import { spawnSync } from "node:child_process"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const preloadPath = fileURLToPath(new URL("../test-env.mjs", import.meta.url))

describe("test environment preload", () => {
  it.each([
    {
      website: "https://test.translatebuff.cn",
      origins: "https://test.translatebuff.cn",
      skip: "true",
    },
    { website: "https://custom.example", origins: "https://custom.example", skip: "false" },
    { website: "", origins: "", skip: undefined },
  ])(
    "pins URL fixtures without changing other settings: $website / $skip",
    ({ website, origins, skip }) => {
      const childEnv = { ...process.env }
      childEnv.WXT_WEBSITE_URL = website
      childEnv.WXT_OFFICIAL_SITE_ORIGINS = origins
      childEnv.WXT_API_URL = "https://api.fixture.example"
      if (skip === undefined) {
        delete childEnv.SKIP_FREE_API
      } else {
        childEnv.SKIP_FREE_API = skip
      }

      const result = spawnSync(
        process.execPath,
        [
          "--import",
          preloadPath,
          "--input-type=module",
          "--eval",
          `console.log(JSON.stringify({
        website: process.env.WXT_WEBSITE_URL,
        origins: process.env.WXT_OFFICIAL_SITE_ORIGINS,
        api: process.env.WXT_API_URL,
        skip: process.env.SKIP_FREE_API ?? null,
      }))`,
        ],
        { env: childEnv, encoding: "utf8", timeout: 10000 },
      )

      expect(result.error).toBeUndefined()
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({
        website: "https://www.readfrog.app",
        origins: "https://readfrog.app,https://www.readfrog.app",
        api: "https://api.fixture.example",
        skip: skip ?? null,
      })
    },
  )
})
