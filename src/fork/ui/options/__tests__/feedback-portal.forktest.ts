import { afterEach, describe, expect, it, vi } from "vitest"

// 断言的是重定向后的解析（上游 featurebase.ts → fork 副本），只在 vitest.fork.config.ts 下成立，
// 故用 .forktest.ts —— 根配置的默认 include 匹配不到，不会误收。

// 固定官网域（同 blog-link.forktest.ts 的做法）：反馈地址不再硬编码后，域来自 WXT_WEBSITE_URL，
// 而裸测试环境没有 .env.production、该值回落上游默认。这里锁住域，让断言对准本次改的路径逻辑。
vi.mock("@/env", () => ({ env: { WXT_WEBSITE_URL: "https://www.translatebuff.cn" } }))

describe("fork 反馈门户 URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("cn 线指向国内官网反馈页（跟随 fork 官网域，不再硬编码）", async () => {
    const { buildFeaturebasePortalUrl } = await import("@/utils/featurebase")
    const url = buildFeaturebasePortalUrl({ destination: "feedback", locale: "zh-CN" })
    expect(url).toContain("translatebuff.cn/feedback")
    expect(url).not.toContain("readfrog.app")
  })

  it("global 线并入海外官网帮助页 /help，且不含 .cn 域", async () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    const { buildFeaturebasePortalUrl } = await import("@/utils/featurebase")
    const url = buildFeaturebasePortalUrl({ destination: "feedback", locale: "en" })
    expect(url).toContain("/help")
    expect(url).not.toContain("/feedback")
    expect(url).not.toContain("readfrog.app")
  })

  it("元数据仍作为查询参数带上（反馈要靠它定位环境）", async () => {
    const { buildFeaturebasePortalUrl } = await import("@/utils/featurebase")
    const url = buildFeaturebasePortalUrl({
      destination: "feedback",
      locale: "zh-CN",
      metadata: { browser: "chrome", extension_version: "1.0.1" },
    })
    expect(url).toContain("browser=chrome")
    expect(url).toContain("extension_version=1.0.1")
  })
})
