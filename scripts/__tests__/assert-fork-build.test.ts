import { describe, expect, it } from "vitest"
import {
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
