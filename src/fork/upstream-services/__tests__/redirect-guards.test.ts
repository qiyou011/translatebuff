import type { Plugin } from "vite"
import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { forkUiRedirectPlugin } from "@/fork/ui-redirect-plugin"

const fixture = vi.hoisted(() => ({
  exists: true,
  content: "export const value = 1",
  fingerprint: "",
}))
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>()
  return {
    ...original,
    existsSync: (path: Parameters<typeof original.existsSync>[0]) =>
      String(path).startsWith("/fixture/") ? fixture.exists : original.existsSync(path),
    readFileSync: (path: Parameters<typeof original.readFileSync>[0], ...args: unknown[]) => {
      if (String(path).startsWith("/fixture/")) return fixture.content
      if (String(path).endsWith("/identity/redirect-baseline.json"))
        return JSON.stringify({
          entries: { "utils/providers/provider-registry.ts": fixture.fingerprint },
        })
      return Reflect.apply(original.readFileSync, original, [path, ...args])
    },
  }
})
function checkFixture() {
  const plugin: Plugin = forkUiRedirectPlugin([
    {
      from: "/fixture/src/utils/providers/provider-registry.ts",
      to: "/fixture/src/fork/upstream-services/provider-registry.ts",
    },
  ])
  const start = plugin.buildStart as () => void
  start()
}
beforeEach(() => {
  fixture.exists = true
  fixture.content = "export const value = 1"
  fixture.fingerprint = createHash("sha256").update(fixture.content).digest("hex").slice(0, 16)
})
describe("cloud redirect drift guards using virtual files", () => {
  it("accepts the reviewed source", () => {
    expect(checkFixture).not.toThrow()
  })
  it("fails when the upstream source disappears", () => {
    fixture.exists = false
    expect(checkFixture).toThrow("源文件不存在")
  })
  it("fails on source changes without modifying the real checkout", () => {
    fixture.content = "export const changedContract = 2"
    expect(checkFixture).toThrow("上游改动了被换皮的文件")
  })
})
