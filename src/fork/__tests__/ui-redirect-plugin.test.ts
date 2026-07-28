import type { Plugin } from "vite"
import { describe, expect, it, vi } from "vitest"
import { forkUiRedirectPlugin, normalizeModuleId } from "../ui-redirect-plugin"

// 目录桶导入样例：上游 config/index.tsx `import { GoogleDriveSyncCard } from "./google-drive-sync"`，
// specifier 末段为目录名 google-drive-sync，实际解析到 google-drive-sync/index.tsx。
const GDS_FROM = "/repo/src/entrypoints/options/pages/config/google-drive-sync/index.tsx"
const GDS_TO = "/repo/src/fork/ui/options/google-drive-sync-card.tsx"
const GDS_IMPORTER = "/repo/src/entrypoints/options/pages/config/index.tsx"

// 单叶子文件样例：与现有 7 条重定向同型（from 直指某 .tsx 文件、非 index 桶）。
const LEAF_FROM = "/repo/src/x/foo.tsx"
const LEAF_TO = "/repo/src/fork/x/foo.tsx"
const LEAF_IMPORTER = "/repo/src/x/index.tsx"

// 构造带 mock this.resolve 的插件上下文：resolvedId 为该 import 解析后的绝对 id（null 表示解析失败）。
function makeCtx(resolvedId: string | null) {
  return {
    resolve: vi.fn<() => Promise<{ id: string } | null>>(async () =>
      resolvedId === null ? null : { id: resolvedId },
    ),
  }
}

// resolveId 在本插件里是普通 async 方法，用 .call 绑定 mock 上下文调用。
function callResolveId(
  plugin: Plugin,
  ctx: { resolve: ReturnType<typeof vi.fn> },
  source: string,
  importer: string | undefined,
) {
  const hook = plugin.resolveId as (
    this: unknown,
    source: string,
    importer: string | undefined,
    options: object,
  ) => Promise<string | null>
  return hook.call(ctx, source, importer, {})
}

describe("forkUiRedirectPlugin.resolveId", () => {
  it("目录桶导入被重定向到 fork to（预筛放行 dir 名 → resolve → 精确匹配 → 顶替）", async () => {
    const plugin = forkUiRedirectPlugin([{ from: GDS_FROM, to: GDS_TO }])
    const ctx = makeCtx(GDS_FROM)
    const result = await callResolveId(plugin, ctx, "./google-drive-sync", GDS_IMPORTER)
    expect(ctx.resolve).toHaveBeenCalled()
    expect(result).toBe(GDS_TO)
  })

  it("单叶子重定向不回归（basename 直接命中 → 顶替）", async () => {
    const plugin = forkUiRedirectPlugin([{ from: LEAF_FROM, to: LEAF_TO }])
    const ctx = makeCtx(LEAF_FROM)
    const result = await callResolveId(plugin, ctx, "./foo", LEAF_IMPORTER)
    expect(result).toBe(LEAF_TO)
  })

  it("resolve 后绝对路径不匹配任何 from → 返回 null（不误重定向）", async () => {
    const plugin = forkUiRedirectPlugin([{ from: LEAF_FROM, to: LEAF_TO }])
    // basename foo 过预筛，但解析到别处的 foo.tsx，精确匹配关失败。
    const ctx = makeCtx("/repo/src/other/foo.tsx")
    const result = await callResolveId(plugin, ctx, "./foo", "/repo/src/other/index.tsx")
    expect(ctx.resolve).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it("importer 缺失 → 返回 null（不触发 resolve）", async () => {
    const plugin = forkUiRedirectPlugin([{ from: LEAF_FROM, to: LEAF_TO }])
    const ctx = makeCtx(LEAF_FROM)
    const result = await callResolveId(plugin, ctx, "./foo", undefined)
    expect(result).toBeNull()
    expect(ctx.resolve).not.toHaveBeenCalled()
  })

  it("自引（importer 正是该重定向的 to）→ 返回 null（避免自引循环）", async () => {
    const plugin = forkUiRedirectPlugin([{ from: LEAF_FROM, to: LEAF_TO }])
    const ctx = makeCtx(LEAF_FROM)
    // fork 覆盖模块 LEAF_TO 内 `export * from 上游原版`：importer 即 to。
    const result = await callResolveId(plugin, ctx, "./foo", LEAF_TO)
    expect(result).toBeNull()
  })

  it("与桶父目录同名的无关模块不被误重定向（预筛放行、精确匹配关兜底）", async () => {
    const plugin = forkUiRedirectPlugin([{ from: GDS_FROM, to: GDS_TO }])
    // utils/atoms/google-drive-sync 与桶父目录同名，但绝对路径不同。
    const ctx = makeCtx("/repo/src/utils/atoms/google-drive-sync.tsx")
    const result = await callResolveId(
      plugin,
      ctx,
      "./google-drive-sync",
      "/repo/src/utils/atoms/index.tsx",
    )
    expect(ctx.resolve).toHaveBeenCalled()
    expect(result).toBeNull()
  })
})

describe("forkUiRedirectPlugin 预筛（targetBasenames）", () => {
  it("桶 from 也登记了 index：./dir/index 形态被放行并顶替", async () => {
    const plugin = forkUiRedirectPlugin([{ from: GDS_FROM, to: GDS_TO }])
    const ctx = makeCtx(GDS_FROM)
    const result = await callResolveId(plugin, ctx, "./google-drive-sync/index", GDS_IMPORTER)
    expect(result).toBe(GDS_TO)
  })

  it("未知 basename 早退：不触发 resolve、返回 null", async () => {
    const plugin = forkUiRedirectPlugin([{ from: GDS_FROM, to: GDS_TO }])
    const ctx = makeCtx("/whatever.tsx")
    const result = await callResolveId(plugin, ctx, "./totally-unrelated", "/repo/src/x/index.tsx")
    expect(ctx.resolve).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})

describe("normalizeModuleId", () => {
  it("去 .tsx/.ts/.jsx/.js 扩展名", () => {
    expect(normalizeModuleId("/a/b.tsx")).toBe("/a/b")
    expect(normalizeModuleId("/a/b.ts")).toBe("/a/b")
    expect(normalizeModuleId("/a/b.jsx")).toBe("/a/b")
    expect(normalizeModuleId("/a/b.js")).toBe("/a/b")
  })

  it("去 ?query（非 ts/js 扩展名保留）", () => {
    expect(normalizeModuleId("/a/b.ts?url")).toBe("/a/b")
    expect(normalizeModuleId("/a/icon.svg?url")).toBe("/a/icon.svg")
  })

  it("反斜杠归一化为正斜杠", () => {
    expect(normalizeModuleId("C:\\a\\b.tsx")).toBe("C:/a/b")
  })
})
