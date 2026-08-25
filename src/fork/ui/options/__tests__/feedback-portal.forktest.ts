import { describe, expect, it } from "vitest"

// 断言的是重定向后的解析（上游 featurebase.ts → fork 副本），只在 vitest.fork.config.ts 下成立，
// 故用 .forktest.ts —— 根配置的默认 include 匹配不到，不会误收。

describe("fork 反馈门户 URL", () => {
  it("悬浮球与侧边栏共用的构造器指向 fork 站点", async () => {
    const { buildFeaturebasePortalUrl } = await import("@/utils/featurebase")
    const url = buildFeaturebasePortalUrl({ destination: "feedback", locale: "zh-CN" })
    expect(url).toContain("translatebuff.cn/feedback")
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
