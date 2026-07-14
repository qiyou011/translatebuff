import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

// 扫描构建产物文本，命中上游域名即视为域名覆盖失败（B3 shell 残留 footgun 的兜底）
export function findUpstreamDomainHits(bundleText, forbidden) {
  return forbidden.filter((d) => bundleText.includes(d))
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(js|json)$/.test(name)) acc.push(p)
  }
  return acc
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const forbidden = ["api.readfrog.app", "www.readfrog.app"]
  const outDir = process.env.FORK_OUT_DIR ?? ".output/chrome-mv3"
  const hits = new Set()
  for (const file of walk(outDir)) {
    for (const d of findUpstreamDomainHits(readFileSync(file, "utf8"), forbidden)) {
      hits.add(`${d} @ ${file}`)
    }
  }
  if (hits.size > 0) {
    console.error("Upstream domains found in bundle (shell WXT_* leak? missing .env.production?):")
    for (const h of hits) console.error(`  - ${h}`)
    process.exit(1)
  }
  console.log("Bundle domain check OK")
}
