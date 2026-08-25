// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SubtitlesTranslateButton } from "@/entrypoints/subtitles.content/ui/subtitles-translate-button"

// 字幕条上的品牌图标是用户可见的 fork 身份，不能是上游的青蛙。
// 靠的是资源级重定向（read-frog.png → fork 品牌图），不是整份换皮组件——
// 上游把图标 import 死在组件顶部，逐个换皮组件太贵，重定向资源一条覆盖全部引用点。
// 走 .forktest 是因为断言的是重定向后的解析——根配置下解析到上游原版，必然失败。
describe("字幕翻译按钮的品牌图标", () => {
  it("不是上游 read-frog 图标", () => {
    render(<SubtitlesTranslateButton />)
    const src = screen.getByRole("img", { hidden: true }).getAttribute("src") ?? ""
    expect(src).not.toContain("read-frog")
  })
})
