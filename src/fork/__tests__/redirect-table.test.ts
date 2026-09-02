import type { Plugin } from "vite"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { FORK_UI_REDIRECTS } from "../../../wxt.config"
import redirectBaseline from "../identity/redirect-baseline.json"
import { forkUiRedirectPlugin, normalizeModuleId } from "../ui-redirect-plugin"

// 表驱动哨兵：逐条断言 resolveId 真的把上游 import 改写成 fork 副本。
//
// 换皮有三层护栏，此前只有前两层是全量的：
//   1. buildStart 的 existsSync —— from 文件还在不在（24/24）
//   2. redirect-baseline.json 指纹 —— from 文件内容变没变（24/24）
//   3. resolveId 有没有真的改写 —— 只有 5 条零散断言，外加一条以「上游独有导出」
//      为判别器的总哨兵；那个判别器随上游自己删掉该导出而失效，静默恒绿。
// 第 3 层塌了的后果是上游原版 UI 在前两层全绿的情况下被打包（命中 plan-badge
// 就是任译喵用户看见 read-frog 的套餐徽标）。这里把第 3 层也做成全量表驱动，
// 且判别器只依赖 fork 自己的重定向表，不再依赖上游保持某个形状。

const projectRoot = path.resolve(__dirname, "../../..")

/** 伪造 rollup 的解析上下文：本测试只关心命中之后的改写，不重跑真实模块解析。 */
function resolveWith(plugin: Plugin, source: string, resolvedId: string, importer: string) {
  const context = {
    resolve: async () => ({ id: resolvedId }),
  }
  const hook = plugin.resolveId as (
    this: unknown,
    source: string,
    importer: string | undefined,
    options: Record<string, unknown>,
  ) => Promise<string | null>
  return hook.call(context, source, importer, {})
}

/**
 * 上游引用换皮文件时 import specifier 的两种形态：直接指向文件，或指向目录靠 index 桶接。
 * 桶导入形态是预筛最容易漏的一种——末段是父目录名而不是 index。
 */
function importSpecifiersFor(from: string): string[] {
  const withoutExtension = normalizeModuleId(from)
  const segments = withoutExtension.split("/")
  if (segments[segments.length - 1] === "index") {
    return [withoutExtension, segments.slice(0, -1).join("/")]
  }
  return [withoutExtension]
}

const plugin = forkUiRedirectPlugin(FORK_UI_REDIRECTS)
const cases = FORK_UI_REDIRECTS.map((redirect) => ({
  label: path.relative(projectRoot, redirect.from),
  ...redirect,
}))

describe("fork 换皮重定向表", () => {
  it("表非空，且每条都指向 fork 领地", () => {
    expect(cases.length).toBeGreaterThan(0)
    for (const redirect of cases) {
      expect(path.relative(projectRoot, redirect.to).replace(/\\/g, "/")).toMatch(/^src\/fork\//)
    }
  })

  it.each(cases)("$label 被改写到 fork 副本", async (redirect) => {
    for (const specifier of importSpecifiersFor(redirect.from)) {
      await expect(resolveWith(plugin, specifier, redirect.from, "/any/importer.ts")).resolves.toBe(
        redirect.to,
      )
    }
  })

  it.each(cases)(
    "$label 的 fork 副本自身 import 上游原版时放行，避免自引循环",
    async (redirect) => {
      await expect(
        resolveWith(plugin, normalizeModuleId(redirect.from), redirect.from, redirect.to),
      ).resolves.toBeNull()
    },
  )

  // 反向对照：证明上面的断言不是恒真——没登记的模块必须原样放行。
  it("未登记的模块不被改写", async () => {
    await expect(
      resolveWith(
        plugin,
        "@/utils/definitely-not-redirected",
        path.resolve(projectRoot, "src/utils/definitely-not-redirected.ts"),
        "/any/importer.ts",
      ),
    ).resolves.toBeNull()
  })

  // 与第 2 层护栏对账：新增重定向若漏登指纹，buildStart 才会报错，本地跑测试时看不见。
  it("每条重定向都登记了内容指纹", () => {
    const recorded = new Set(Object.keys(redirectBaseline.entries))
    const missing = cases
      .map((redirect) => redirect.from.replace(/\\/g, "/").split("/src/")[1])
      .filter((key) => !key || !recorded.has(key))
    expect(missing).toEqual([])
  })
})
