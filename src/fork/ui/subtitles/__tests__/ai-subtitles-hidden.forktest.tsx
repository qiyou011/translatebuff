// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AiQuotaSection } from "@/entrypoints/options/pages/video-subtitles/ai-quota"
import { RequestAiSubtitlesItem } from "@/entrypoints/subtitles.content/ui/subtitles-settings-panel/components/request-ai-subtitles-item"

// 上游 AI 字幕依赖它自建的转录后端（orpc videoTranscript），并挂在 Pro/Ultra 分钟配额下。
// 任译喵没有对应服务（是否立项见 MUL-63），两个入口都要挡住。
//
// 两个入口缺一不可：选项页的配额区是「看得见」的那个，而字幕面板主菜单里的
// 「请求 AI 字幕」才是用户真点得到的——点下去会走 ensureAiSubtitlesEntitled()
// 弹上游订阅引导。上一轮只挡了前者，冒烟时才发现后者漏了。
describe("AI 字幕入口已被 fork 影子隐藏", () => {
  it("选项页配额区不渲染", () => {
    const { container } = render(<AiQuotaSection />)
    expect(container.innerHTML).toBe("")
  })

  it("字幕面板「请求 AI 字幕」菜单项不渲染", () => {
    const { container } = render(<RequestAiSubtitlesItem />)
    expect(container.innerHTML).toBe("")
  })
})
