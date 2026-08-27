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

// 双向域名断言：本 edition 的域名必须出现（证明 env 注入生效），另一 edition 的绝不能出现（防两线串味）。
// 两份 env 都在仓内，直接把文本传进来即可——不读文件、保持纯函数可测。
//
// localeText（可选，来自 src/locales/*.yml 源文件）用来把「界面文案里的域名」与「端点配置里的域名」分开：
// 本断言拦的是端点串味（海外包指向国内后端这种构建期无声、用户登录才炸的失败），
// 而界面文案跨线共用同一份 locale（产品已确认统一用品牌主域 translatebuff.com），由 check-fork-brand.mjs
// 另行守卫。命中文案源的域名归 copyLeaked（告警），
// 其余归 leaked（构建 fail-fast）。取舍：端点常量若恰好与文案同域，会被豁免遮蔽——不传 localeText 即全严格。
export function checkEditionDomains(bundleText, ownEnvText, otherEnvText, localeText = "") {
  // 去重：readForkDomainsFromEnv 对 WXT_API_URL / WXT_WEBSITE_URL 各返一条，两者常同值。
  const own = [...new Set(readForkDomainsFromEnv(ownEnvText))]
  const other = [...new Set(readForkDomainsFromEnv(otherEnvText))].filter(
    (host) => !own.includes(host),
  )
  const hits = findUpstreamDomainHits(bundleText, other)
  return {
    missing: findMissingForkDomains(bundleText, own),
    leaked: hits.filter((host) => !localeText.includes(host)),
    copyLeaked: hits.filter((host) => localeText.includes(host)),
  }
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
  // 当前 edition 决定读哪份正式配置；另一份用来算「绝不能出现的域名」。
  const edition = process.env.WXT_FORK_EDITION === "global" ? "global" : "cn"
  // 默认产物目录随 edition 走，与 wxt.config.ts 的 outDirTemplate 一致——否则手动跑本脚本校验
  // 海外产物时会去扫国内目录，扫到的是另一条线的旧产物，断言结果毫无意义。
  const outDir =
    process.env.FORK_OUT_DIR ?? `.output/chrome-mv3${edition === "global" ? "-global" : ""}`
  const envPathOf = (id) => (id === "global" ? ".env.global.production" : ".env.production")

  const readEnv = (path) => {
    try {
      return readFileSync(path, "utf8")
    } catch {
      return ""
    }
  }
  const envProductionText = readEnv(envPathOf(edition))
  const otherEnvText = readEnv(envPathOf(edition === "global" ? "cn" : "global"))

  // 登录后端域缺失即 fail-fast：fork 直读 import.meta.env.WXT_RENYIMIAO_API_URL，漏配则登录取到
  // undefined。（此域 ≠ 翻译网关常量 RENYIMIAO_GATEWAY_BASE_URL，勿混。）
  if (!hasRenyimiaoApiUrl(envProductionText)) {
    console.error(
      "缺少登录后端域 WXT_RENYIMIAO_API_URL（.env.production 未配置或为空）——登录将取到 undefined，构建 fail-fast",
    )
    process.exit(1)
  }

  if (readForkDomainsFromEnv(envProductionText).length === 0) {
    console.error(
      `无法从 ${envPathOf(edition)} 解析 fork 域名（缺失或非法），无法校验 env 覆盖是否生效`,
    )
    process.exit(1)
  }

  let bundleText = ""
  for (const file of walk(outDir)) bundleText += readFileSync(file, "utf8")

  // 界面文案源：locale 里的域名跨线共用，归 copyLeaked 告警而非 fail-fast（见 checkEditionDomains 注释）。
  let localeText = ""
  try {
    for (const name of readdirSync("src/locales")) {
      if (name.endsWith(".yml")) localeText += readFileSync(join("src/locales", name), "utf8")
    }
  } catch {
    // locale 目录不可读（非仓根执行）：退回全严格
  }
  const { missing, leaked, copyLeaked } = checkEditionDomains(
    bundleText,
    envProductionText,
    otherEnvText,
    localeText,
  )
  if (missing.length > 0) {
    console.error(
      `edition=${edition} 的 fork 域名在产物中缺失（env 覆盖未生效？shell 残留 WXT_*？）:`,
    )
    for (const d of missing) console.error(`  - ${d}`)
    process.exit(1)
  }
  // 反向断言：另一条线的域名混进产物 = 配置串味。构建期无声、装上能用、用户登录才炸，
  // 只有在这里拦得住（绕过 pack.mjs 直接 wxt zip 就没有这层保护）。
  if (leaked.length > 0) {
    console.error(`edition=${edition} 的产物混入了另一条线的域名（两线配置串味）——构建 fail-fast:`)
    for (const d of leaked) console.error(`  - ${d}`)
    process.exit(1)
  }
  // 文案里的另一线域名：产品已确认界面文案统一用品牌主域 translatebuff.com，两条线共用同一份 locale
  // （2026-08-26 决策，MUL-67）。故不阻断构建，仅回声一行——真出现新的文案域名时仍看得见。
  if (copyLeaked.length > 0) {
    console.log(
      `提示：edition=${edition} 的界面文案含 ${copyLeaked.join(", ")}（locale 跨线共用品牌主域，已确认保留）`,
    )
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

  console.log(`Fork build domain check OK（edition=${edition}，本线域名已生效、无另一线域名）`)
}
