import { afterEach, describe, expect, it, vi } from "vitest"
import { WEBSITE_ROUTES, websiteRouteBasePath } from "../website-routes"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("websiteRouteBasePath（对外跳转基础路径按 edition 解析）", () => {
  it("cn 线四条路径逐字保持现状", () => {
    expect(websiteRouteBasePath("login")).toBe("/login")
    expect(websiteRouteBasePath("orders")).toBe("/orders")
    expect(websiteRouteBasePath("uninstallSurvey")).toBe("/uninstall-survey")
    expect(websiteRouteBasePath("feedback")).toBe("/feedback")
  })

  it("global 线取海外官网真实路径（订单在账户中心下、问卷在插件产品页下、反馈并入帮助页）", () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    expect(websiteRouteBasePath("login")).toBe("/login")
    expect(websiteRouteBasePath("orders")).toBe("/account/orders")
    expect(websiteRouteBasePath("uninstallSurvey")).toBe("/extension/uninstall-survey")
    expect(websiteRouteBasePath("feedback")).toBe("/help")
  })

  it("两条线的路由键集合一致（漏配一条即失败）", () => {
    expect(Object.keys(WEBSITE_ROUTES.global).sort()).toEqual(Object.keys(WEBSITE_ROUTES.cn).sort())
  })

  it("所有路径以 / 起、无尾斜杠——locale 前缀要拼在它前面", () => {
    for (const table of Object.values(WEBSITE_ROUTES)) {
      for (const path of Object.values(table)) {
        expect(path.startsWith("/")).toBe(true)
        expect(path.endsWith("/")).toBe(false)
      }
    }
  })
})
