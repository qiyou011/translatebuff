import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

// 命中给定上游域名列表（纯函数，供测试与信息性告警复用）
export function findUpstreamDomainHits(bundleText, forbidden) {
  return forbidden.filter((d) => bundleText.includes(d))
}

// 缺失的必需 fork 域名。env 覆盖生效时 fork 域名必然出现在产物里；
// 若 shell 残留 WXT_* 把 active 后端指回上游，fork 域名会缺失 → 返回非空 = 断言失败
export function findMissingForkDomains(bundleText, required) {
  return required.filter((d) => !bundleText.includes(d))
}

// 从 .env.production 文本派生 fork 域名（与构建消费同一 env 源，换域名只改 .env.production 一处）
export function readForkDomainsFromEnv(envText) {
  const hosts = []
  for (const key of ["WXT_API_URL", "WXT_WEBSITE_URL"]) {
    const match = envText.match(new RegExp(`^${key}=(.+)$`, "m"))
    if (!match) continue
    try {
      hosts.push(new URL(match[1].trim()).host)
    } catch {
      // 忽略非法 URL
    }
  }
  return hosts
}

// 从本地 .env（gitignore、仅 dev）派生「测试后端域」——它们绝不该出现在生产产物里。
// 读 dev 会用到的 URL 变量的 hostname；剔除 localhost/回环地址（通用、可能合法出现，且非敏感）。
// 刻意不在本脚本硬编码任何真实测试域名（本仓公开），改由 gitignored 的 .env 派生。
export function readTestDomainsFromEnv(envText) {
  const hosts = []
  const keys = [
    "WXT_RENYIMIAO_API_URL",
    "WXT_RENYIMIAO_GATEWAY_URL",
    "WXT_WEBSITE_URL",
    "WXT_OFFICIAL_SITE_ORIGINS",
  ]
  for (const key of keys) {
    const match = envText.match(new RegExp(`^${key}=(.+)$`, "m"))
    if (!match) continue
    // 逗号分隔（如 WXT_OFFICIAL_SITE_ORIGINS 可含多个 origin）
    for (const raw of match[1].trim().split(",")) {
      try {
        const host = new URL(raw.trim()).hostname
        if (host !== "localhost" && host !== "127.0.0.1" && !hosts.includes(host)) {
          hosts.push(host)
        }
      } catch {
        // 忽略非法 URL
      }
    }
  }
  return hosts
}

// 登录后端域是否已在 .env.production 声明且非空。fork 直读 import.meta.env.WXT_RENYIMIAO_API_URL
// （绕 t3-env schema），缺失即运行期取到 undefined、登录静默失效，故构建期据此 fail-fast。
// 此域是「登录后端域」（common_bll/claw_bff），与翻译网关域（WXT_RENYIMIAO_GATEWAY_URL）
// 是两个不同域、不同性质，勿混。
function hasRenyimiaoApiUrl(envText) {
  const match = envText.match(/^WXT_RENYIMIAO_API_URL=(.+)$/m)
  return Boolean(match && match[1].trim() !== "")
}

// 上游 v1.46.4 引入 partner-bridge 内容脚本，往合作方站点注入脚本（Jalapeno Cloud）。
// 该能力对任译喵毫无用处，却会在 manifest 里多一条对外可见的站点注入权限，国内商店过审敏感。
// 删 entrypoint 是一次性的，这条断言防的是「下次同步又被带回来」。
const PARTNER_SITE_TOKENS = ["jalapeno-cloud.ai"]

export function findPartnerSiteHits(manifest) {
  const patterns = [
    ...(manifest.host_permissions ?? []),
    ...(manifest.content_scripts ?? []).flatMap((entry) => entry.matches ?? []),
  ]
  return patterns.filter((pattern) =>
    PARTNER_SITE_TOKENS.some((token) => String(pattern).includes(token)),
  )
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, acc)
    else if (/\.(js|json)$/.test(entry.name)) acc.push(p)
  }
  return acc
}

// 兼容 Windows 的入口判定：直接运行时才跑 CLI，被测试 import 时不触发
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const upstreamResidual = ["api.readfrog.app", "www.readfrog.app"]
  const outDir = process.env.FORK_OUT_DIR ?? ".output/chrome-mv3"

  let envProductionText = ""
  try {
    envProductionText = readFileSync(".env.production", "utf8")
  } catch {
    // .env.production 缺失
  }

  // 登录后端域缺失即 fail-fast：fork 直读 import.meta.env.WXT_RENYIMIAO_API_URL，漏配则登录取到
  // undefined。（此域 ≠ 翻译网关常量 RENYIMIAO_GATEWAY_BASE_URL，勿混。）
  if (!hasRenyimiaoApiUrl(envProductionText)) {
    console.error(
      "缺少登录后端域 WXT_RENYIMIAO_API_URL（.env.production 未配置或为空）——登录将取到 undefined，构建 fail-fast",
    )
    process.exit(1)
  }

  const requiredForkDomains = readForkDomainsFromEnv(envProductionText)
  if (requiredForkDomains.length === 0) {
    console.error("无法从 .env.production 解析 fork 域名（缺失或非法），无法校验 env 覆盖是否生效")
    process.exit(1)
  }

  let bundleText = ""
  for (const file of walk(outDir)) bundleText += readFileSync(file, "utf8")

  const missing = findMissingForkDomains(bundleText, requiredForkDomains)
  if (missing.length > 0) {
    console.error("Fork 域名在产物中缺失（env 覆盖未生效？shell 残留 WXT_*？）:")
    for (const d of missing) console.error(`  - ${d}`)
    process.exit(1)
  }

  // 测试域泄漏守卫：本地 .env（gitignore、仅 dev）里的测试后端域绝不该进生产产物。
  // .env 缺失（CI 干净构建）时无从泄漏、跳过；谁本地误带 .env 打 prod 包 / env 覆盖失效 → 在此 fail-fast。
  let envDevText = ""
  try {
    envDevText = readFileSync(".env", "utf8")
  } catch {
    // .env 缺失：CI 干净构建，无测试域可泄漏
  }
  const testLeaks = findUpstreamDomainHits(bundleText, readTestDomainsFromEnv(envDevText))
  if (testLeaks.length > 0) {
    console.error(
      "生产产物泄漏测试后端域（误带 .env 打 prod 包？env 覆盖未生效？）——构建 fail-fast:",
    )
    for (const d of testLeaks) console.error(`  - ${d}`)
    process.exit(1)
  }

  // 残留上游域名多来自 env 默认回退字面量与尚未重建的 UI 链接（完整 UI 重建范围），
  // 运行时 active 值已是 fork，故此处仅告警，不阻断构建
  const residual = findUpstreamDomainHits(bundleText, upstreamResidual)
  if (residual.length > 0) {
    console.warn(
      `提示：产物仍含上游域名（默认回退字面量或未重建的 UI 链接，待完整 UI 重建清理）: ${residual.join(", ")}`,
    )
  }

  // 合作方站点注入权限：上游 partner-bridge 内容脚本会把 jalapeno-cloud.ai 写进 manifest，
  // 国内商店过审敏感。删 entrypoint 是一次性的，这里防的是下次同步又被带回来。
  try {
    const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"))
    const partnerHits = findPartnerSiteHits(manifest)
    if (partnerHits.length > 0) {
      console.error("产物 manifest 含合作方站点注入权限（应随 partner-bridge 一并删除）:")
      for (const hit of partnerHits) console.error(`  - ${hit}`)
      process.exit(1)
    }
  } catch (error) {
    console.error(`无法读取产物 manifest 做合作方站点断言: ${error.message}`)
    process.exit(1)
  }

  console.log("Fork build domain check OK（fork 域名已生效）")
}
