import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearLastReportedDate, readLastReportedDate, toUtcDateKey } from "../active-dedup"

const postClickEvent = vi.fn<(...args: any[]) => any>()

// 只挡 i18n 门面：它顶层 import src/locales/*.yml，而根 vitest 配置不带 ViteYaml 插件。
// 归一逻辑照抄真实实现的「非 auto 原样返回」分支（同 background/membership 测试）。
vi.mock("@/utils/i18n/locale-map", () => ({
  resolveUiLocale: (uiLanguage: string) => (uiLanguage === "auto" ? "en" : uiLanguage),
}))

vi.mock("../report-client", () => ({
  CLICK_EVENT_PATH: "/api/data_report/v1/client/click_event",
  buildReportHeaders: () => ({}),
  postClickEvent: (...args: unknown[]) => postClickEvent(...args),
}))

const { reportTranslateActive } = await import("../track-active")

const TODAY = Date.UTC(2026, 7, 31, 10, 0)
const LATER_TODAY = Date.UTC(2026, 7, 31, 22, 0)
const TOMORROW = Date.UTC(2026, 8, 1, 10, 0)

beforeEach(async () => {
  postClickEvent.mockReset()
  postClickEvent.mockResolvedValue(undefined)
  await clearLastReportedDate()
})

afterEach(async () => {
  await clearLastReportedDate()
})

describe("活跃事件按自然日去重", () => {
  it("当日首次翻译上报一次", async () => {
    await reportTranslateActive(TODAY)

    expect(postClickEvent).toHaveBeenCalledTimes(1)
    const [events] = postClickEvent.mock.calls[0]!
    expect(events).toHaveLength(1)
    expect(events[0].click_name).toBe("translate_active")
    expect(events[0].action_extra_info).toEqual({ is_active: true })
  })

  it("同日再次翻译不上报，也不发请求", async () => {
    await reportTranslateActive(TODAY)
    await reportTranslateActive(LATER_TODAY)

    expect(postClickEvent).toHaveBeenCalledTimes(1)
  })

  it("跨自然日重新上报", async () => {
    await reportTranslateActive(TODAY)
    await reportTranslateActive(TOMORROW)

    expect(postClickEvent).toHaveBeenCalledTimes(2)
  })
})

describe("先标记再上报", () => {
  it("上报失败也记为今日已报，避免断网时每次翻译都重发", async () => {
    postClickEvent.mockRejectedValue(new Error("network down"))

    await expect(reportTranslateActive(TODAY)).resolves.toBeUndefined()
    expect(await readLastReportedDate()).toBe(toUtcDateKey(TODAY))

    postClickEvent.mockReset()
    postClickEvent.mockResolvedValue(undefined)
    await reportTranslateActive(LATER_TODAY)
    expect(postClickEvent).not.toHaveBeenCalled()
  })
})

// 三个调用点都是 `void reportTranslateActive()`，函数一旦 reject 就是未处理的 rejection。
// 契约是「永不 reject」，storage 抽风也不例外。
describe("永不 reject", () => {
  it("去重存储读取抛错时也照常 resolve", async () => {
    const dedup = await import("../active-dedup")
    const spy = vi
      .spyOn(dedup, "readLastReportedDate")
      .mockRejectedValue(new Error("storage unavailable"))

    await expect(reportTranslateActive(TODAY)).resolves.toBeUndefined()

    spy.mockRestore()
  })
})
