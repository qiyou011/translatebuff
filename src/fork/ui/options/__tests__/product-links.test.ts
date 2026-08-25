import { describe, expect, it } from "vitest"
import { FORK_PRODUCT_LINKS } from "@/fork/ui/options/product-links"

// 上游「产品」组是路线图 + 反馈，都指向它自家的 Featurebase 门户。
// 任译喵没有路线图页，反馈也走自己的站点。
describe("fork options 侧边栏「产品」组", () => {
  it("不含路线图入口", () => {
    expect(FORK_PRODUCT_LINKS.some((link) => link.labelKey === "options.product.roadmap")).toBe(
      false,
    )
  })

  it("反馈指向 fork 站点，不指向上游 Featurebase 门户", () => {
    const feedback = FORK_PRODUCT_LINKS.find((link) => link.labelKey === "options.product.feedback")
    expect(feedback?.href).toBe("https://www.translatebuff.cn/feedback")
    expect(feedback?.href).not.toContain("featurebase")
  })
})
