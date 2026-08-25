// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SidebarProvider } from "@/components/ui/base-ui/sidebar"
import { ContextMenuPage } from "@/entrypoints/options/pages/context-menu"

vi.mock("@/entrypoints/options/pages/context-menu/context-menu-translate-toggle", () => ({
  ContextMenuTranslateToggle: () => null,
}))

// jsdom 不实现 matchMedia，而 SidebarProvider 会读它判断移动端断点
window.matchMedia = vi.fn<(query: string) => MediaQueryList>().mockReturnValue({
  matches: false,
  addEventListener: vi.fn<() => void>(),
  removeEventListener: vi.fn<() => void>(),
} as unknown as MediaQueryList)

// 上游这三个 options 页用静态截图当功能示意图，截图里是 read-frog 的界面。
// fork 改成实时渲染的 CSS 插画（含品牌标），既不漏上游品牌、也不用维护三张截图。
describe("options 功能示意区", () => {
  it("渲染 fork 插画而非上游截图", () => {
    const { container } = render(
      <SidebarProvider>
        <ContextMenuPage />
      </SidebarProvider>,
    )
    const imgs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? "")
    expect(imgs.some((src) => src.includes("demo/"))).toBe(false)
    expect(container.querySelector("[data-fork-overlay-preview]")).not.toBeNull()
  })
})
