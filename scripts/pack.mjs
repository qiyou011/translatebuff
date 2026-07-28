// fork 打包命令：node scripts/pack.mjs <test|store>
//   test  —— 注入本地 .env 测试后端值（子进程 env 优先级最高、盖过 .env.production）+ FORK_PACK=test，
//            出 translatebuff-<版本>-test-<浏览器>.zip；打包后正向断言「测试域必须在产物里」，
//            防 env 注入静默失效、打出实为指向生产后端的假测试包。
//   store —— 不注入 .env，.env.production 驱动（.env 的重叠键被其覆盖）出正式包；
//            打包后跑 assert-fork-build（生产域 + 防测试域泄漏）+ check-fork-brand。
// 均调 `wxt zip`（非 build）——文件名/env 消费只在 zip 路径生效。spawnSync 传 env、不拼 shell 字符串（跨平台）。

import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { findUpstreamDomainHits, readTestDomainsFromEnv } from "./assert-fork-build.mjs"

const mode = process.argv[2]
if (mode !== "test" && mode !== "store") {
  console.error("用法: node scripts/pack.mjs <test|store>")
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
  // store：不注入 .env，.env.production 驱动（.env 的重叠键被其覆盖）；再跑生产域 + 品牌校验
  run("pnpm", ["exec", "wxt", "zip"])
  run("node", ["scripts/assert-fork-build.mjs"])
  run("node", ["scripts/check-fork-brand.mjs"])
  console.log("\n✓ 正式包 OK：生产域校验 + 品牌校验通过")
}
