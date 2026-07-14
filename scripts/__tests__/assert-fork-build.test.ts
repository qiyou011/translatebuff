import { describe, expect, it } from "vitest"
import { findMissingForkDomains, findUpstreamDomainHits } from "../assert-fork-build.mjs"

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
