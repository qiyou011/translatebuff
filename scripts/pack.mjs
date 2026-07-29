// fork 打包命令：
//   node scripts/pack.mjs test                     —— 测试包（本地 .env 测试后端 + FORK_PACK=test，chrome）
//   node scripts/pack.mjs store --channel <id>     —— 单渠道正式包（补打某一渠道）
//   node scripts/pack.mjs store --all              —— 一键全渠道正式包（遍历注册表）
//
//   test  —— 注入本地 .env 测试后端值（子进程 env 优先级最高、盖过 .env.production）+ FORK_PACK=test，
//            出 translatebuff-<版本>-test-<浏览器>.zip；打包后正向断言「测试域必须在产物里」，
//            防 env 注入静默失效、打出实为指向生产后端的假测试包。
//   store —— 不注入 .env，.env.production 驱动出正式包。渠道 id 由 WXT_FORK_CHANNEL 注入、浏览器目标从
//            渠道注册表（src/fork/identity/channels.json）推导；产物名按渠道 id（同浏览器双渠道不撞车）。
//            打包后跑 assert-fork-build（生产域 + 防测试域泄漏 + 渠道号非 null）+ check-fork-brand。
//            护栏：裸 store（无 --channel/--all）报错；--channel 指未分配号码渠道硬报错；--all 跳过未分配渠道续跑。
// 均调 `wxt zip`（非 build）——文件名/env 消费只在 zip 路径生效。spawnSync 传 env、不拼 shell 字符串（跨平台）。

import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findUpstreamDomainHits, readTestDomainsFromEnv } from "./assert-fork-build.mjs"

const CHANNELS_PATH = "src/fork/identity/channels.json"

const mode = process.argv[2]
const rest = process.argv.slice(3)
if (mode !== "test" && mode !== "store") {
  console.error(
    "用法:\n  node scripts/pack.mjs test\n  node scripts/pack.mjs store --channel <id>\n  node scripts/pack.mjs store --all",
  )
  process.exit(1)
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
// assert-fork-build 读 FORK_OUT_DIR 定位产物目录（.output/<browser>-mv3）。品牌校验只扫源码、与渠道无关，
// 由 store 入口统一跑一次（不随渠道重复扫源），故不在此。
function packChannel(id, entry) {
  const zipArgs = ["exec", "wxt", "zip", "-b", entry.browser]
  if (entry.browser === "firefox") zipArgs.push("--mv3")
  const outDir = `.output/${entry.browser}-mv3`
  run("pnpm", zipArgs, { WXT_FORK_CHANNEL: id })
  run("node", ["scripts/assert-fork-build.mjs"], { FORK_OUT_DIR: outDir, WXT_FORK_CHANNEL: id })
  console.log(`\n✓ 渠道 ${id}（${entry.browser}）正式包 OK`)
}

if (mode === "test") {
  let envText
  try {
    envText = readFileSync(".env", "utf8")
  } catch {
    console.error("缺少本地 .env（测试后端配置）——无法打测试包")
    process.exit(1)
  }
  // 注入 .env 测试值（盖过 .env.production 的生产值）+ 打包意图
  run("pnpm", ["exec", "wxt", "zip"], { ...parseDotenv(envText), FORK_PACK: "test" })

  // 正向断言：测试域必须出现在产物里，否则 env 注入失效、实际打出的是指向生产后端的假测试包
  const testDomains = readTestDomainsFromEnv(envText)
  const present = findUpstreamDomainHits(collectBundleText(".output/chrome-mv3"), testDomains)
  if (present.length === 0) {
    console.error(
      `\n✗ 测试域未出现在产物里（env 注入失效？）——期望含: ${testDomains.join(", ")}。fail-fast`,
    )
    process.exit(1)
  }
  console.log(`\n✓ 测试包 OK：产物含测试后端域 ${present.join(", ")}`)
} else {
  // store：正式包，渠道从注册表解析、浏览器目标推导。
  const channels = readChannels()
  const wantAll = rest.includes("--all")
  const channelFlagIdx = rest.indexOf("--channel")
  const channelId = channelFlagIdx >= 0 ? rest[channelFlagIdx + 1] : undefined

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
      if (entry.number === null) {
        console.warn(`\n✗ 跳过渠道 ${id}：号码未分配（待后端分配）`)
        skipped.push(id)
        continue
      }
      packChannel(id, entry)
      built.push(id)
    }
    console.log("\n===== 全渠道打包汇总 =====")
    console.log(`已出（${built.length}）：${built.join(", ") || "（无）"}`)
    console.log(`已跳过·号码未分配（${skipped.length}）：${skipped.join(", ") || "（无）"}`)
  } else {
    // 单渠道补打：未知 id / 号码未分配 → 硬报错（点名要它、不容跳过）。
    const entry = channels[channelId]
    if (!entry) {
      console.error(`未知渠道 id: ${channelId}（可选：${Object.keys(channels).join(", ")}）`)
      process.exit(1)
    }
    if (entry.number === null) {
      console.error(`渠道 ${channelId} 号码未分配（待后端分配）——无法打包`)
      process.exit(1)
    }
    packChannel(channelId, entry)
  }
}
