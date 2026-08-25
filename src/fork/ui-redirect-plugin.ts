import type { Plugin } from "vite"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"

// fork「换皮」重定向插件（从 wxt.config 迁入 fork 领地，重定向清单作入参传入）：
// 不编辑上游 composed UI 源文件，改由 resolve 插件按解析后的绝对路径把上游组件重定向到 fork 版
// （相对 / @ import 都拦得住）。清单里的绝对路径由调用方 path.resolve(__dirname, …) 算好后传入。

export function normalizeModuleId(id: string): string {
  return id
    .replace(/\\/g, "/")
    .split("?")[0]
    .replace(/\.(t|j)sx?$/, "")
}

export function forkUiRedirectPlugin(redirects: { from: string; to: string }[]): Plugin {
  const normalized = redirects.map((redirect) => ({
    from: normalizeModuleId(redirect.from),
    to: redirect.to,
  }))
  // 预筛用：能命中重定向的 import，其 specifier 末段必为某个 from 的 basename。
  // 目录桶导入（from 指向 <dir>/index.tsx）时 specifier 末段是父目录名而非 index，
  // 故 from 末段为 index 时同时登记 index 与父目录名，否则桶导入会漏过预筛、重定向静默失效。
  const targetBasenames = new Set(
    normalized.flatMap((redirect) => {
      const seg = redirect.from.split("/")
      const base = seg.pop()!
      return base === "index" ? [base, seg.pop()!] : [base]
    }),
  )
  return {
    name: "fork-ui-redirect",
    enforce: "pre",
    buildStart() {
      // 构建期断言：上游一旦移动/重命名被换皮的文件，from 绝对路径失效 → resolveId 再不命中 →
      // 上游原版 UI 被静默打包（无报错、CI 全绿、皮悄悄掉）。这里把静默失效变成响亮的构建失败，
      // 与 wxt.config 里 check-api-key-env 的 buildStart 校验同构。
      for (const redirect of redirects) {
        if (!existsSync(redirect.from)) {
          throw new Error(
            `\n\nfork-ui-redirect: 换皮目标源文件不存在，重定向将静默失效：\n` +
              `   - ${redirect.from}\n\n` +
              `上游可能已移动/重命名该文件，请同步更新 wxt.config 的 FORK_UI_REDIRECTS。\n`,
          )
        }
      }
      // 路径存在不代表内容没变：上游改了被换皮文件，构建照样绿、皮却已经与上游行为偏离。
      // 指纹比对把这种静默偏离变成硬失败。用 LF 归一化后取 sha256，不读 git blob——
      // 本仓 .gitattributes 是 * text=auto eol=lf，跨平台检出会产生假失配。
      assertRedirectFingerprints(redirects)
    },
    async resolveId(source, importer, options) {
      if (!importer) {
        return null
      }
      // basename 预筛：先按末段早退，跳过全图 ~99.9% 的 import，避免对每个 import 都跑 this.resolve
      // （enforce:"pre" 下会给全项目模块解析翻倍）。命中重定向必然末段在 targetBasenames 内，预筛安全且完整。
      const sourceBasename = normalizeModuleId(source).split("/").pop() ?? ""
      if (!targetBasenames.has(sourceBasename)) {
        return null
      }
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved) {
        return null
      }
      const resolvedId = normalizeModuleId(resolved.id)
      const match = normalized.find((redirect) => redirect.from === resolvedId)
      if (!match) {
        return null
      }
      // 放行 fork 覆盖模块 import 它所替换的上游原版：否则 fork/*.ts 里 `export * from 上游`
      // 会被重定向回自身，形成自引循环。仅当 importer 正是该重定向的目标文件时跳过。
      if (importer && normalizeModuleId(importer) === normalizeModuleId(match.to)) {
        return null
      }
      return match.to
    },
  }
}

/** 内容指纹：LF 归一化后取 sha256，跨平台稳定。 */
export function fingerprintFile(absolutePath: string): string {
  const content = readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n")
  return createHash("sha256").update(content).digest("hex").slice(0, 16)
}

function assertRedirectFingerprints(redirects: { from: string; to: string }[]) {
  const baselinePath = new URL("./identity/redirect-baseline.json", import.meta.url)
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as {
    entries: Record<string, string>
  }
  const drifted: string[] = []
  const missing: string[] = []
  for (const redirect of redirects) {
    // 键用「相对 src 的路径（含扩展名）」，不要过 normalizeModuleId——它会削掉 .ts/.tsx，
    // 与基线里的键对不上，查不到记录就静默跳过检查，等于这层护栏根本没跑。
    const key = redirect.from.replace(/\\/g, "/").split("/src/")[1]
    const recorded = key ? baseline.entries[key] : undefined
    const actual = fingerprintFile(redirect.from)
    if (!recorded) {
      missing.push(`   - src/${key ?? redirect.from}`)
      continue
    }
    if (recorded !== actual) {
      drifted.push(`   - src/${key}\n     记录 ${recorded} → 实际 ${actual}`)
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `\n\nfork-ui-redirect: 有重定向没有登记内容指纹，这层护栏对它们不生效：\n` +
        `${missing.join("\n")}\n\n` +
        `请把它们补进 src/fork/identity/redirect-baseline.json。\n`,
    )
  }
  if (drifted.length > 0) {
    throw new Error(
      `\n\nfork-ui-redirect: 上游改动了被换皮的文件，fork 副本可能已与上游行为偏离：\n` +
        `${drifted.join("\n")}\n\n` +
        `请先 diff 上游改动、判断要不要搬进 fork 副本，再更新 ` +
        `src/fork/identity/redirect-baseline.json 的指纹。不要直接刷新了事。\n`,
    )
  }
}
