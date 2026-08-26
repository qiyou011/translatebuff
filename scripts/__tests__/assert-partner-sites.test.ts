import { describe, expect, it } from "vitest"
import { findPartnerSiteHits } from "../assert-fork-build.mjs"

// 上游 v1.46.4 新增 partner-bridge 内容脚本，matches 打到 jalapeno-cloud.ai，
// 会在 manifest 里多一条站点注入权限 —— 国内商店过审敏感，必须整块删除。
// 删文件是一次性的，这条断言是防回归的：下次同步若把它带回来，构建门直接拦住。
describe("findPartnerSiteHits", () => {
  it("揪出 content_scripts 里的合作方站点", () => {
    const manifest = {
      content_scripts: [{ matches: ["https://jalapeno-cloud.ai/*"], js: ["x.js"] }],
    }
    expect(findPartnerSiteHits(manifest)).toEqual(["https://jalapeno-cloud.ai/*"])
  })

  it("揪出 host_permissions 里的合作方站点", () => {
    expect(findPartnerSiteHits({ host_permissions: ["https://jalapeno-cloud.ai/*"] })).toEqual([
      "https://jalapeno-cloud.ai/*",
    ])
  })

  it("正常 manifest 无命中", () => {
    const manifest = {
      content_scripts: [{ matches: ["<all_urls>"], js: ["x.js"] }],
      host_permissions: ["https://translatebuff.cn/*"],
    }
    expect(findPartnerSiteHits(manifest)).toEqual([])
  })
})
