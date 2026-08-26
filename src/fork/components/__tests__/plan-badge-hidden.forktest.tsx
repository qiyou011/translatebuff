// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PlanBadge } from "@/components/badges/plan-badge"

// 上游的 PlanBadge 有两个职责：标注账号所在套餐（账号菜单），以及标注某功能需要哪个
// 套餐并挂升级引导（Built-in AI 的 provider 行）。两者都是 read-frog 自家的计费体系，
// 任译喵有自己的会员标识（ForkAccountMenu 里的 PRO 徽标），不该再显示上游套餐。
//
// 走 .forktest：断言的是重定向后的解析。
describe("上游套餐徽标已被 fork 影子隐藏", () => {
  it("不渲染任何内容", () => {
    const { container } = render(<PlanBadge plan="ultra" />)
    expect(container.innerHTML).toBe("")
  })

  it("带升级引导时同样不渲染（不留上游付费入口）", () => {
    const { container } = render(<PlanBadge plan="pro" upgradeTooltip="upgrade" />)
    expect(container.innerHTML).toBe("")
  })
})
