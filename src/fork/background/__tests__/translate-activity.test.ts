import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"

const reportTranslateActive = vi.fn<(...args: any[]) => any>()

vi.mock("@/fork/analytics/track-active", () => ({
  reportTranslateActive: (...args: unknown[]) => reportTranslateActive(...args),
}))

// @webext-core/messaging 同一 JS 上下文里每个 type 只允许一个监听器，重复注册即抛错；
// 本文件每个用例都要重跑 setup，故把 fork 消息层换成可重复注册的替身，并顺带捕获处理器。
const forkHandlers = new Map<string, () => void>()

vi.mock("@/fork/message", () => ({
  onForkMessage: (type: string, handler: () => void) => forkHandlers.set(type, handler),
  sendForkMessage: vi.fn<(...args: unknown[]) => void>(),
}))

const { TRANSLATE_ACTIVITY_MESSAGE_TYPES, setupTranslateActivity } =
  await import("../translate-activity")

type RawListener = (message: unknown) => unknown

/** 注册后取回挂上去的原生监听器，直接投喂消息信封。 */
function registerAndCapture(): RawListener {
  const addListener = vi.fn<(...args: any[]) => any>()
  browser.runtime.onMessage.addListener = addListener as never

  setupTranslateActivity()

  return addListener.mock.calls[0]![0] as RawListener
}

beforeEach(() => {
  reportTranslateActive.mockReset()
  reportTranslateActive.mockResolvedValue(undefined)
})

// 三条翻译通路里的两条走 background 消息；@webext-core/messaging 每个 type 只允许一个
// onMessage 监听器，故这里挂原生 runtime.onMessage 做被动观察。
describe("background 侧的翻译活跃观察", () => {
  it("网页/划词/输入翻译的消息触发一次上报", () => {
    const listener = registerAndCapture()

    listener({ type: "enqueueTranslateRequest", timestamp: 1 })

    expect(reportTranslateActive).toHaveBeenCalledTimes(1)
  })

  it("视频字幕的消息触发一次上报", () => {
    const listener = registerAndCapture()

    listener({ type: "enqueueSubtitlesTranslateRequest", timestamp: 1 })

    expect(reportTranslateActive).toHaveBeenCalledTimes(1)
  })

  it("无关消息不触发上报", () => {
    const listener = registerAndCapture()

    listener({ type: "forkPing", timestamp: 1 })

    expect(reportTranslateActive).not.toHaveBeenCalled()
  })

  it("形状异常的消息不触发上报，也不抛", () => {
    const listener = registerAndCapture()

    expect(() => listener(null)).not.toThrow()
    expect(() => listener("enqueueTranslateRequest")).not.toThrow()
    expect(reportTranslateActive).not.toHaveBeenCalled()
  })

  // 返回 true 或 Promise 等于认领响应通道，上游 handler 的回复会被这个观察器截走，
  // 表现为翻译请求永远拿不到结果——这是本设计最危险的失败形态。
  it("监听器返回 undefined，绝不认领响应通道", () => {
    const listener = registerAndCapture()

    expect(listener({ type: "enqueueTranslateRequest", timestamp: 1 })).toBeUndefined()
    expect(listener({ type: "forkPing", timestamp: 1 })).toBeUndefined()
  })

  it("翻译中心的 fork 消息同样触发一次上报", () => {
    registerAndCapture()

    forkHandlers.get("forkReportTranslateActivity")!()

    expect(reportTranslateActive).toHaveBeenCalledTimes(1)
  })

  it("通路清单锁定：新增翻译入口时必须同步补进来", () => {
    expect([...TRANSLATE_ACTIVITY_MESSAGE_TYPES]).toEqual([
      "enqueueTranslateRequest",
      "enqueueSubtitlesTranslateRequest",
    ])
  })
})
