import { describe, expect, it } from "vitest"
import {
  checkEditionDomains,
  findCrossEditionSourceHits,
  findMissingForkDomains,
  findUpstreamDomainHits,
  readForkDomainsFromEnv,
  readTestDomainsFromEnv,
} from "../assert-fork-build.mjs"

describe("findUpstreamDomainHits", () => {
  it("命中上游域名时返回该域名", () => {
    const hits = findUpstreamDomainHits('fetch("https://api.readfrog.app/x")', ["api.readfrog.app"])
    expect(hits).toEqual(["api.readfrog.app"])
  })

  it("仅含 fork 域名时返回空数组", () => {
    const hits = findUpstreamDomainHits('fetch("https://api.translatebuff.com/x")', [
      "api.readfrog.app",
    ])
    expect(hits).toEqual([])
  })
})

describe("findMissingForkDomains", () => {
  it("fork 域名齐全时无缺失", () => {
    const text = "api.translatebuff.com | www.translatebuff.com"
    expect(
      findMissingForkDomains(text, ["api.translatebuff.com", "www.translatebuff.com"]),
    ).toEqual([])
  })

  it("缺少 fork 域名时返回缺失项（env 覆盖未生效的信号）", () => {
    expect(
      findMissingForkDomains("only api.translatebuff.com here", [
        "api.translatebuff.com",
        "www.translatebuff.com",
      ]),
    ).toEqual(["www.translatebuff.com"])
  })
})

describe("readForkDomainsFromEnv", () => {
  it("从 .env.production 文本解析 WXT_API_URL/WXT_WEBSITE_URL 的 host", () => {
    const envText = [
      "WXT_API_URL=https://api.translatebuff.com",
      "WXT_WEBSITE_URL=https://www.translatebuff.com",
      "WXT_AUTH_COOKIE_DOMAINS=translatebuff.com",
    ].join("\n")
    expect(readForkDomainsFromEnv(envText)).toEqual([
      "api.translatebuff.com",
      "www.translatebuff.com",
    ])
  })

  it("缺失这两个键时返回空数组", () => {
    expect(readForkDomainsFromEnv("WXT_AUTH_COOKIE_DOMAINS=translatebuff.com")).toEqual([])
  })
})

describe("readTestDomainsFromEnv（从 .env 派生测试后端域，用于泄漏守卫）", () => {
  it("派生 hostname，剔除 localhost/回环", () => {
    const envText = [
      "WXT_RENYIMIAO_API_URL=https://cbs-test.example.com",
      "WXT_WEBSITE_URL=http://localhost:3000",
      "WXT_OFFICIAL_SITE_ORIGINS=http://localhost:3000",
    ].join("\n")
    expect(readTestDomainsFromEnv(envText)).toEqual(["cbs-test.example.com"])
  })

  it("逗号分隔多 origin 全解析、去重、剔除回环", () => {
    const envText =
      "WXT_OFFICIAL_SITE_ORIGINS=https://a.example.com,http://127.0.0.1:3000,https://a.example.com"
    expect(readTestDomainsFromEnv(envText)).toEqual(["a.example.com"])
  })

  it(".env 为空 → 空数组（CI 干净构建无测试域可泄漏、守卫跳过）", () => {
    expect(readTestDomainsFromEnv("")).toEqual([])
  })
})

describe("checkEditionDomains（双向域名断言：本线必须在、另一线绝不能在）", () => {
  const CN_ENV = [
    "WXT_API_URL=https://translatebuff.cn",
    "WXT_WEBSITE_URL=https://translatebuff.cn",
  ].join("\n")
  const GLOBAL_ENV = [
    "WXT_API_URL=https://www.translatebuff.com",
    "WXT_WEBSITE_URL=https://www.translatebuff.com",
  ].join("\n")

  it("本线域名齐全 + 无另一线域名 → 通过", () => {
    const result = checkEditionDomains("cfg={host:'www.translatebuff.com'}", GLOBAL_ENV, CN_ENV)
    expect(result).toEqual({ missing: [], leaked: [], copyLeaked: [] })
  })

  it("本线域名缺失 → 报 missing（env 注入未生效的信号）", () => {
    const result = checkEditionDomains("cfg={host:'example.org'}", GLOBAL_ENV, CN_ENV)
    expect(result.missing).toEqual(["www.translatebuff.com"])
  })

  it("海外包混入 .cn 域 → 报 leaked（两线配置串味，本变更的首要失败形态）", () => {
    const bundle = "a='www.translatebuff.com' b='translatebuff.cn'"
    expect(checkEditionDomains(bundle, GLOBAL_ENV, CN_ENV).leaked).toEqual(["translatebuff.cn"])
  })

  it("国内包混入 .com 域 → 同样报 leaked（反向也拦）", () => {
    const bundle = "a='translatebuff.cn' b='www.translatebuff.com'"
    expect(checkEditionDomains(bundle, CN_ENV, GLOBAL_ENV).leaked).toEqual([
      "www.translatebuff.com",
    ])
  })

  it("只出现在界面文案里的另一线域名 → 归 copyLeaked（告警），不判构建失败", () => {
    const bundle = "a='translatebuff.cn' copy='Sign in on www.translatebuff.com'"
    const localeText = "loginRequired: Sign in on www.translatebuff.com"
    const result = checkEditionDomains(bundle, CN_ENV, GLOBAL_ENV, localeText)
    expect(result.leaked).toEqual([])
    expect(result.copyLeaked).toEqual(["www.translatebuff.com"])
  })

  it("文案里有、但产物里另有非文案来源的同一域名 → 仍归 leaked（不被文案豁免遮蔽）", () => {
    // 端点常量与文案共用同一域名时，豁免只能按「域名是否出现在文案源」判断——
    // 这是刻意取舍：文案豁免会遮住同域的端点泄漏，故 leaked 判定仅对未出现在文案源的域名生效。
    const localeText = "copy: www.translatebuff.com"
    const result = checkEditionDomains("cfg=www.translatebuff.com", CN_ENV, GLOBAL_ENV, localeText)
    expect(result.copyLeaked).toEqual(["www.translatebuff.com"])
  })

  it("本线 env 自己被改成另一线的域 → 仍判 leaked（禁止清单不能被 own 注销）", () => {
    // 最直接的「配置串味」形态：有人把 .env.global.production 的 WXT_API_URL 改成了 .cn。
    // 此时 .cn 同时出现在 own 与 other 里；若拿 own 去过滤 other，禁止清单会被清空、
    // 护栏把自己注销掉——实测过这个洞：坏配置照样 exit 0 且打印「无另一线域名」。
    const brokenGlobalEnv = [
      "WXT_API_URL=https://translatebuff.cn",
      "WXT_WEBSITE_URL=https://www.translatebuff.com",
    ].join("\n")
    const bundle = "a='translatebuff.cn' b='www.translatebuff.com'"
    const result = checkEditionDomains(bundle, brokenGlobalEnv, CN_ENV)
    expect(result.leaked).toEqual(["translatebuff.cn"])
  })

  it("不传文案源 → 全部按 leaked 处理（默认最严）", () => {
    const bundle = "a='translatebuff.cn' b='www.translatebuff.com'"
    const result = checkEditionDomains(bundle, CN_ENV, GLOBAL_ENV)
    expect(result.leaked).toEqual(["www.translatebuff.com"])
    expect(result.copyLeaked).toEqual([])
  })
})

describe("findCrossEditionSourceHits（源码层扫另一线域名）", () => {
  // 产物层扫描对国内线是空转的：它唯一的禁止域 www.translatebuff.com 出现在 9 份 locale 文案里，
  // 被文案豁免整条吃掉。而当年抓到 branding.ts 死常量靠的正是这条禁止域——加了豁免后它已抓不到了。
  // 源码层扫描绕开这个死结：文案只住在 src/locales/，排掉那个目录，其余任何命中都是真的端点/常量泄漏。
  it("命中源码里的另一线域名（branding.ts 那种死常量）", () => {
    const entries = [
      { path: "src/fork/branding.ts", content: 'websiteUrl: "https://www.translatebuff.com",' },
    ]
    expect(findCrossEditionSourceHits(entries, ["www.translatebuff.com"])).toEqual([
      { file: "src/fork/branding.ts", host: "www.translatebuff.com" },
    ])
  })

  it("注释里的散文提及不算泄漏（索引表、换皮说明都会写到另一线域名）", () => {
    const entries = [
      { path: "a.ts", content: "// cn = 国内线（translatebuff.cn），global = 海外线\nconst x = 1" },
      { path: "b.ts", content: "/* 换皮到 translatebuff.cn/feedback */\nconst y = 2" },
    ]
    expect(findCrossEditionSourceHits(entries, ["translatebuff.cn"])).toEqual([])
  })

  it("剥注释不能吃掉 https:// 里的双斜杠（否则真泄漏反而漏网）", () => {
    const entries = [{ path: "a.ts", content: 'const u = "https://www.translatebuff.com"' }]
    expect(findCrossEditionSourceHits(entries, ["www.translatebuff.com"])).toEqual([
      { file: "a.ts", host: "www.translatebuff.com" },
    ])
  })

  it("干净源码返回空", () => {
    const entries = [{ path: "src/fork/branding.ts", content: 'name: "TranslateBuff",' }]
    expect(findCrossEditionSourceHits(entries, ["www.translatebuff.com"])).toEqual([])
  })

  it("同一文件多个禁止域各报一条", () => {
    const entries = [{ path: "a.ts", content: "x=translatebuff.cn; y=www.translatebuff.com" }]
    expect(
      findCrossEditionSourceHits(entries, ["translatebuff.cn", "www.translatebuff.com"]),
    ).toHaveLength(2)
  })
})
