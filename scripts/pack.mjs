// fork 打包命令：
//   node scripts/pack.mjs test [--edition cn|global]  —— 测试包（本地测试后端 + FORK_PACK=test，chrome）
//   node scripts/pack.mjs store --channel <id>     —— 单渠道正式包（补打某一渠道）
//   node scripts/pack.mjs store --all              —— 一键全渠道正式包（遍历注册表）
//   以上 store 命令均可加 --edition cn|global 指定发行版；不传 = cn（国内线），既有行为逐字不变。
//
//   test  —— 注入本地测试后端值（子进程 env 优先级最高、盖过 .env.production）+ FORK_PACK=test。
//            配置源按 edition 取：cn 读 .env、global 读 .env.global（两份都 gitignored、各自本地维护）。
//            出 translatebuff-<版本>-test[-global]-<浏览器>.zip；打包后正向断言「测试域必须在产物里」，
//            防 env 注入静默失效、打出实为指向生产后端的假测试包。
//   store —— 不注入 .env，.env.production 驱动出正式包。渠道 id 由 WXT_FORK_CHANNEL 注入、浏览器目标从
//            渠道注册表（src/fork/identity/channels.json）推导；产物名按渠道 id（同浏览器双渠道不撞车）。
//            打包后跑 assert-fork-build（生产域 + 防测试域泄漏 + 渠道号非 null）+ check-fork-brand。
//            护栏：裸 store（无 --channel/--all）报错；--channel 指未分配号码渠道硬报错；--all 跳过未分配渠道续跑。
// --edition —— 发行版维度。global 时读 .env.global.production 并把键值经子进程 env 注入（优先级盖过
//            WXT 自动读的 .env.production，与 test 模式同一条路），同时注入 WXT_FORK_EDITION 让
//            bundle 侧的路径表/渠道表/manifest 身份一并切线。渠道范围按 edition 圈定，跨线取渠道硬报错。
//            断言侧据此做双向域名校验：本线域名必须在、另一线域名绝不能在。
// 均调 `wxt zip`（非 build）——文件名/env 消费只在 zip 路径生效。spawnSync 传 env、不拼 shell 字符串（跨平台）。

import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  checkEditionDomains,
  findUpstreamDomainHits,
  readTestDomainsFromEnv,
} from "./assert-fork-build.mjs"

const CHANNELS_PATH = "src/fork/identity/channels.json"
// 与 src/fork/identity/edition.ts 的 ForkEdition 保持一致（本文件是 .mjs，import 不了那个 TS 模块）。
const EDITIONS = ["cn", "global"]
// 各 edition 的正式配置源。cn 走 WXT 自动读的 .env.production，无需注入；global 需显式注入。
const EDITION_ENV_PATH = { cn: ".env.production", global: ".env.global.production" }
// 测试包的配置源（本地 gitignored，各自维护；真实测试后端值不入库）。
const EDITION_TEST_ENV_PATH = { cn: ".env", global: ".env.global" }

const mode = process.argv[2]
const rest = process.argv.slice(3)
if (mode !== "test" && mode !== "store") {
  console.error(
    "用法:\n  node scripts/pack.mjs test\n  node scripts/pack.mjs store [--edition cn|global] --channel <id>\n  node scripts/pack.mjs store [--edition cn|global] --all",
  )
  process.exit(1)
}

// 解析 --edition：不传 → cn（既有行为不变）；未知值硬报错，绝不静默回落——回落会打出一个
// 名为海外、实指国内后端的包，构建期无声、装上能用、用户登录才炸。
const editionFlagIdx = rest.indexOf("--edition")
const edition = editionFlagIdx >= 0 ? rest[editionFlagIdx + 1] : "cn"
if (!EDITIONS.includes(edition)) {
  console.error(`未知 edition: ${edition}（可选：${EDITIONS.join(", ")}）`)
  process.exit(1)
}

// 产物目录：与 wxt.config.ts 的 outDirTemplate 同一套规则（海外加 -global），三处消费方共用此函数，
// 免得漏改其中一处、断言扫到另一条线的旧产物还判绿。
function outDirOf(browser) {
  return `.output/${browser}-mv3${edition === "global" ? "-global" : ""}`
}

// 跑子命令，失败即整体 fail-fast（继承 stdio 便于看 wxt 输出）
function run(cmd, args, extraEnv) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  })
  if (res.status !== 0) {
    console.error(`\n命令失败（退出码 ${res.status}）: ${cmd} ${args.join(" ")}`)
    process.exit(res.status ?? 1)
  }
}

// 递归收集产物文本（.js/.json），供测试域正向断言
function collectBundleText(dir) {
  let text = ""
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) text += collectBundleText(p)
    else if (/\.(js|json)$/.test(entry.name)) text += readFileSync(p, "utf8")
  }
  return text
}

// 极简 dotenv 解析：仅取 KEY=value 行，忽略注释/空行（值不含引号，够本仓 .env 用）
function parseDotenv(text) {
  const env = {}
  for (const line of text.split("\n")) {
    if (/^\s*#/.test(line) || !line.trim()) continue
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

// 读渠道注册表（与 bundle 侧 channel.ts 共用同一 JSON 真源）
function readChannels() {
  return JSON.parse(readFileSync(CHANNELS_PATH, "utf8"))
}

// 按渠道打一个正式包：推导浏览器 → set WXT_FORK_CHANNEL → wxt zip -b <browser> → 生产域/渠道号断言（逐渠道）。
// assert-fork-build 读 FORK_OUT_DIR 定位产物目录（见 outDirOf）。品牌校验只扫源码、与渠道无关，
// 由 store 入口统一跑一次（不随渠道重复扫源），故不在此。
function packChannel(id, entry, editionEnv) {
  const zipArgs = ["exec", "wxt", "zip", "-b", entry.browser]
  if (entry.browser === "firefox") zipArgs.push("--mv3")
  const outDir = outDirOf(entry.browser)
  const forkEnv = { ...editionEnv, WXT_FORK_CHANNEL: id, WXT_FORK_EDITION: edition }
  run("pnpm", zipArgs, forkEnv)
  run("node", ["scripts/assert-fork-build.mjs"], { ...forkEnv, FORK_OUT_DIR: outDir })
  console.log(`\n✓ 渠道 ${id}（${entry.browser}，edition=${edition}）正式包 OK`)
}

if (mode === "test") {
  const testEnvPath = EDITION_TEST_ENV_PATH[edition]
  let envText
  try {
    envText = readFileSync(testEnvPath, "utf8")
  } catch {
    // 点名缺的是哪一份，且绝不回落另一 edition 的配置——回落会打出一个名为海外、实指国内后端的假测试包。
    console.error(`缺少本地 ${testEnvPath}（edition=${edition} 的测试后端配置）——无法打测试包`)
    process.exit(1)
  }
  // 注入测试值（盖过 .env.production 的生产值）+ 打包意图 + edition（驱动跳转路径 / 商店身份 / 渠道表）
  run("pnpm", ["exec", "wxt", "zip"], {
    ...parseDotenv(envText),
    FORK_PACK: "test",
    WXT_FORK_EDITION: edition,
  })

  // 正向断言：测试域必须出现在产物里，否则 env 注入失效、实际打出的是指向生产后端的假测试包
  const testDomains = readTestDomainsFromEnv(envText)
  const present = findUpstreamDomainHits(collectBundleText(outDirOf("chrome")), testDomains)
  if (present.length === 0) {
    console.error(
      `\n✗ 测试域未出现在产物里（env 注入失效？）——期望含: ${testDomains.join(", ")}。fail-fast`,
    )
    process.exit(1)
  }
  // 反向断言：另一条线的生产域绝不该进本线测试包。漏配一个 WXT_* 就会静默回落 .env.production 的
  // 国内生产域——正向断言只看「测试域在不在」，看不见这种混入，非得在这里拦。
  // 界面文案里的跨线域名走 copyLeaked 豁免（与正式包同一套判定，见 checkEditionDomains）。
  const otherProdPath = EDITION_ENV_PATH[edition === "global" ? "cn" : "global"]
  let otherProdText = ""
  try {
    otherProdText = readFileSync(otherProdPath, "utf8")
  } catch {
    // 另一线的生产配置缺失：无从比对，跳过反向断言
  }
  let localeText = ""
  try {
    for (const name of readdirSync("src/locales")) {
      if (name.endsWith(".yml")) localeText += readFileSync(join("src/locales", name), "utf8")
    }
  } catch {
    // locale 不可读：退回全严格
  }
  const { leaked } = checkEditionDomains(
    collectBundleText(outDirOf("chrome")),
    envText,
    otherProdText,
    localeText,
  )
  if (leaked.length > 0) {
    console.error(
      `\n✗ 测试包（edition=${edition}）混入了另一条线的生产域——多半是 ${testEnvPath} 漏配了某个 WXT_* 、回落到 .env.production。fail-fast:`,
    )
    for (const d of leaked) console.error(`  - ${d}`)
    process.exit(1)
  }

  console.log(`\n✓ 测试包 OK（edition=${edition}）：产物含测试后端域 ${present.join(", ")}`)
} else {
  // store：正式包，渠道从注册表解析、浏览器目标推导。
  const channels = readChannels()
  const wantAll = rest.includes("--all")
  const channelFlagIdx = rest.indexOf("--channel")
  const channelId = channelFlagIdx >= 0 ? rest[channelFlagIdx + 1] : undefined

  // 海外线的配置不是 WXT 自动读的那份，必须显式注入；文件缺失即终止，不得回落 .env.production
  // 续跑——那会打出一个名为海外、实指国内后端的包。
  let editionEnv = {}
  if (edition !== "cn") {
    const envPath = EDITION_ENV_PATH[edition]
    try {
      editionEnv = parseDotenv(readFileSync(envPath, "utf8"))
    } catch {
      console.error(`缺少 edition=${edition} 的正式配置 ${envPath}——无法打包`)
      process.exit(1)
    }
  }

  // 护栏：裸 store 必须显式指定渠道，不再沉默回落 7100（官网包亦须 --channel zip）。
  if (!wantAll && !channelId) {
    console.error(
      "store 模式必须显式指定渠道：--channel <id> 或 --all（官网包亦须 --channel zip）。不再沉默回落 7100。",
    )
    process.exit(1)
  }

  // 品牌校验只扫源码、与渠道/浏览器无关 → 全渠道打包只跑一次（不随渠道重复扫源）。
  run("node", ["scripts/check-fork-brand.mjs"])

  if (wantAll) {
    // 一键全渠道：号已分配→打包+断言；号未分配→打印跳过续跑；真实构建/断言失败由 run() fail-fast。
    const built = []
    const skipped = []
    for (const [id, entry] of Object.entries(channels)) {
      if (entry.edition !== edition) continue // 只打本 edition 的渠道
      if (entry.number === null) {
        console.warn(`\n✗ 跳过渠道 ${id}：号码未分配（待后端分配）`)
        skipped.push(id)
        continue
      }
      packChannel(id, entry, editionEnv)
      built.push(id)
    }
    console.log(`\n===== 全渠道打包汇总（edition=${edition}）=====`)
    console.log(`已出（${built.length}）：${built.join(", ") || "（无）"}`)
    console.log(`已跳过·号码未分配（${skipped.length}）：${skipped.join(", ") || "（无）"}`)
  } else {
    // 单渠道补打：未知 id / 号码未分配 → 硬报错（点名要它、不容跳过）。
    const entry = channels[channelId]
    if (!entry) {
      console.error(`未知渠道 id: ${channelId}（可选：${Object.keys(channels).join(", ")}）`)
      process.exit(1)
    }
    if (entry.edition !== edition) {
      console.error(
        `渠道 ${channelId} 属于 edition ${entry.edition}，与当前 edition ${edition} 不符——无法打包`,
      )
      process.exit(1)
    }
    if (entry.number === null) {
      console.error(`渠道 ${channelId} 号码未分配（待后端分配）——无法打包`)
      process.exit(1)
    }
    packChannel(channelId, entry, editionEnv)
  }
}
