import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

// 品牌守卫：扫描界面显示面（locale + 入口 index.html）里的两类禁用 token。
// 挂在同步仪式 / CI，堵住上游同步引入的品牌漂移与自有品牌写法漂移。

// ① 上游品牌残留（各语种意译/音译形态）。同步上游后新串若带这些，需重刷成 fork 品牌。
//    仅匹配显示形态；技术串 read-frog / readfrog.app（连字符/小写、URL、CSS 选择器）天然不在内。
const UPSTREAM_BRAND_TOKENS = ["Read Frog", "陪读蛙", "陪讀蛙", "読書カエル"]

// ② fork 品牌错误写法：英文名必须大写 B「TranslateBuff」（与 FORK_BRANDING.name / APP_NAME 一致，
//    保证 kebabCase 结果含连字符 → side.content 自定义元素名合法）。禁止小写「Translatebuff」。
//    注：不匹配 translatebuff.com（小写 t 域名）/ translate-buff（kebab），二者均不含该 token。
const BRAND_CASING_TOKENS = ["Translatebuff"]

const FORBIDDEN_TOKENS = [...UPSTREAM_BRAND_TOKENS, ...BRAND_CASING_TOKENS]

// 纯函数：给定文件条目 [{ path, content }]，逐行扫出全部禁用 token 命中。
export function findResidualBrand(entries) {
  const violations = []
  for (const { path: file, content } of entries) {
    content.split("\n").forEach((line, i) => {
      const hit = FORBIDDEN_TOKENS.find((token) => line.includes(token))
      if (hit) violations.push({ file, line: i + 1, token: hit, text: line.trim().slice(0, 80) })
    })
  }
  return violations
}

// 收集受守卫的显示面文件：9 个 locale + 各入口 index.html。
function collectEntries(root) {
  const entries = []
  const localesDir = path.join(root, "src/locales")
  for (const name of readdirSync(localesDir)) {
    if (name.endsWith(".yml")) {
      entries.push({
        path: `src/locales/${name}`,
        content: readFileSync(path.join(localesDir, name), "utf8"),
      })
    }
  }
  const entrypointsDir = path.join(root, "src/entrypoints")
  for (const dir of readdirSync(entrypointsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const htmlPath = path.join(entrypointsDir, dir.name, "index.html")
    try {
      entries.push({
        path: `src/entrypoints/${dir.name}/index.html`,
        content: readFileSync(htmlPath, "utf8"),
      })
    } catch {
      // 该入口无 index.html（非 html 入口），跳过
    }
  }
  return entries
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const violations = findResidualBrand(collectEntries(process.cwd()))
  if (violations.length > 0) {
    console.error("检测到品牌 token 违规（界面显示面）:")
    for (const v of violations) console.error(`  - ${v.file}:${v.line}  「${v.token}」  ${v.text}`)
    console.error("\n修复：上游残留 → 换 fork 品牌（拉丁 TranslateBuff / 中文 任译喵·任譯喵）；")
    console.error("     小写 Translatebuff → 大写 TranslateBuff（英文名必须大写 B）。")
    process.exit(1)
  }
  console.log("Fork brand OK（无上游残留、无品牌写法漂移）")
}
