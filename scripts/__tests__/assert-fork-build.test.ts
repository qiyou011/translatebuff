import { describe, expect, it } from "vitest"
import {
  checkEditionDomains,
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

  it("不传文案源 → 全部按 leaked 处理（默认最严）", () => {
    const bundle = "a='translatebuff.cn' b='www.translatebuff.com'"
    const result = checkEditionDomains(bundle, CN_ENV, GLOBAL_ENV)
    expect(result.leaked).toEqual(["www.translatebuff.com"])
    expect(result.copyLeaked).toEqual([])
  })
})
