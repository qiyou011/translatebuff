import { describe, expect, it } from "vitest"
import {
  findMissingForkDomains,
  findUpstreamDomainHits,
  readForkDomainsFromEnv,
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
