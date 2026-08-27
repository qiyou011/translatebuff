import { execFileSync } from "node:child_process"
import { existsSync, renameSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"

// 测试包的 edition 维度：国内读 .env、海外读 .env.global。
// 只测「选哪份配置」与「缺配置怎么报错」这两条护栏——真跑 wxt zip 近一分钟，且依赖本地
// gitignored 配置是否存在，不适合进单测。pack.mjs 是纯脚本（无入口守卫），故只能走 CLI 断言。
const hidden = new Map<string, string>()

function hide(path: string): void {
  if (existsSync(path)) {
    const to = `${path}.__hidden_by_test__`
    renameSync(path, to)
    hidden.set(path, to)
  }
}

afterEach(() => {
  for (const [original, temp] of hidden) renameSync(temp, original)
  hidden.clear()
})

function runPack(args: string[]): { status: number; output: string } {
  try {
    const output = execFileSync("node", ["scripts/pack.mjs", ...args], {
      encoding: "utf8",
      stdio: "pipe",
    })
    return { status: 0, output }
  } catch (error: any) {
    return { status: error.status ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` }
  }
}

describe("pack.mjs test 的 edition 护栏", () => {
  it("未知 edition → 硬报错并列出可选值", () => {
    const { status, output } = runPack(["test", "--edition", "eu"])
    expect(status).not.toBe(0)
    expect(output).toContain("未知 edition")
  })

  it("global 缺 .env.global → 点名该文件报错，不回落 .env 打出假海外测试包", () => {
    hide(".env.global")
    const { status, output } = runPack(["test", "--edition", "global"])
    expect(status).not.toBe(0)
    expect(output).toContain(".env.global")
  })

  it("cn 缺 .env → 点名 .env 报错（既有行为不变，且不会错报成 .env.global）", () => {
    hide(".env")
    const { status, output } = runPack(["test"])
    expect(status).not.toBe(0)
    expect(output).toContain(".env")
    expect(output).not.toContain(".env.global")
  })
})
