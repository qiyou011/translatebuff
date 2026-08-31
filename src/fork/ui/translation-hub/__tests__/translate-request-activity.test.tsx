import { createStore } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"

const sendForkMessage = vi.fn<(...args: any[]) => any>()

vi.mock("@/fork/message", () => ({
  sendForkMessage: (...args: unknown[]) => sendForkMessage(...args),
  onForkMessage: () => {},
}))

const { translateRequestAtom } = await import("../atoms")

const REQUEST = {
  inputText: "hello",
  sourceLanguage: "eng",
  targetLanguage: "cmn",
  timestamp: 1,
} as never

beforeEach(() => {
  sendForkMessage.mockReset()
  sendForkMessage.mockResolvedValue(undefined)
})

// 翻译中心在页面内直调 executeTranslate、不发上游消息，故这条通路挂在
// 用户点翻译时写入的 translateRequestAtom 上（同文件 selectedProviderIdsAtom 的既有模式）。
describe("翻译中心的活跃信号", () => {
  it("写入翻译请求时发出活跃消息", () => {
    const store = createStore()

    store.set(translateRequestAtom, REQUEST)

    expect(sendForkMessage).toHaveBeenCalledWith("forkReportTranslateActivity")
  })

  it("写入的值原样读得回来，透传不被破坏", () => {
    const store = createStore()

    store.set(translateRequestAtom, REQUEST)

    expect(store.get(translateRequestAtom)).toEqual(REQUEST)
  })

  it("清空请求（写 null）不算一次活跃", () => {
    const store = createStore()

    store.set(translateRequestAtom, null)

    expect(sendForkMessage).not.toHaveBeenCalled()
  })
})
