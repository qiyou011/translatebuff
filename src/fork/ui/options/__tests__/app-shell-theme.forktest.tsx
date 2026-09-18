// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cleanup, render } from "@testing-library/react"
import { generate, parse, walk } from "css-tree"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Button } from "@/components/ui/base-ui/button"
import { AppShell } from "@/entrypoints/options/app-shell"

const optionsThemeCss = readFileSync(
  resolve(process.cwd(), "src/fork/ui/options/options-theme.css"),
  "utf8",
)

vi.mock("@/entrypoints/options/app-sidebar", () => ({ AppSidebar: () => null }))
vi.mock("@/entrypoints/options/narrow-top-bar", () => ({ NarrowTopBar: () => null }))
vi.mock("@/components/ui/base-ui/sidebar", () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

const OPTIONS_THEME_ATTRIBUTE = "data-translatebuff-options-theme"

beforeEach(() => {
  document.documentElement.removeAttribute(OPTIONS_THEME_ATTRIBUTE)
  document.documentElement.className = "light"
})

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute(OPTIONS_THEME_ATTRIBUTE)
  document.documentElement.removeAttribute("class")
})

describe("options 文档主题作用域", () => {
  it("实际 Button 类名中的 SVG 尺寸选择器不会让文字按钮漏掉主题尺寸", () => {
    const { getByRole } = render(
      <AppShell>
        <Button>
          <svg aria-hidden="true" />
          导出
        </Button>
        <Button size="icon-sm" aria-label="查看">
          <svg aria-hidden="true" />
        </Button>
      </AppShell>,
    )
    const textButton = getByRole("button", { name: "导出" })
    const iconButton = getByRole("button", { name: "查看" })
    const textButtonSizeRules: string[] = []
    walk(parse(optionsThemeCss), {
      visit: "Rule",
      enter(node) {
        if (node.prelude.type !== "SelectorList") return
        const declarations = generate(node.block)
        if (declarations.includes("min-width:132px") && declarations.includes("height:40px")) {
          node.prelude.children.forEach((selector) => textButtonSizeRules.push(generate(selector)))
        }
      },
    })
    expect(textButtonSizeRules.some((selector) => textButton.matches(selector))).toBe(true)
    expect(textButtonSizeRules.some((selector) => iconButton.matches(selector))).toBe(false)
    document.documentElement.removeAttribute(OPTIONS_THEME_ATTRIBUTE)
    expect(textButtonSizeRules.some((selector) => textButton.matches(selector))).toBe(false)
  })

  it("随 AppShell 挂载和清理且保留现有主题状态", () => {
    const { unmount } = render(
      <AppShell>
        <p>settings</p>
      </AppShell>,
    )

    expect(document.documentElement.hasAttribute(OPTIONS_THEME_ATTRIBUTE)).toBe(true)
    expect(document.documentElement.classList.contains("light")).toBe(true)

    unmount()

    expect(document.documentElement.hasAttribute(OPTIONS_THEME_ATTRIBUTE)).toBe(false)
    expect(document.documentElement.classList.contains("light")).toBe(true)
  })

  it("将 Figma 下拉规范限制在 options 文档并覆盖所有现有下拉类型", () => {
    expect(optionsThemeCss).toContain("--rf-option-foreground: #17171c;")
    expect(optionsThemeCss).toContain("--rf-option-highlight: #f4f4f6;")
    expect(optionsThemeCss).toContain('[data-slot="combobox-trigger"]')
    expect(optionsThemeCss).toContain('[data-slot="select-content"] > [role="listbox"]')
    expect(optionsThemeCss).toContain('[data-slot="combobox-list"]')
    expect(optionsThemeCss).toContain('> [data-slot="input-group"]::before')
    expect(optionsThemeCss).toContain('background-image: url("./assets/search.svg");')
    expect(optionsThemeCss).toContain("min-width: var(--anchor-width);")
    expect(optionsThemeCss).toContain("background: var(--rf-option-highlight);")
  })

  it("统一基础控件与侧边栏到 Figma 组件尺寸", () => {
    expect(optionsThemeCss).toContain('[data-slot="switch"]')
    expect(optionsThemeCss).toContain("width: 44px !important;")
    expect(optionsThemeCss).toContain("height: 24px !important;")
    expect(optionsThemeCss).toContain('[data-slot="switch-thumb"]')
    expect(optionsThemeCss).toContain('[data-slot="sidebar-menu-sub"]')
    expect(optionsThemeCss).toContain("margin: 0 0 0 24px;")
    expect(optionsThemeCss).toContain("border-left: 0;")
    expect(optionsThemeCss).toContain('[data-slot="input"] + [data-slot="button"]')
    expect(optionsThemeCss).toContain("min-width: 40px;")
    expect(optionsThemeCss).toContain('[data-slot="table"]')
    expect(optionsThemeCss).toContain("min-width: 32px;")
  })
})
