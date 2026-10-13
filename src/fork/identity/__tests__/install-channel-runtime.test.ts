import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { onForkMessage, sendForkMessage } from "@/fork/message"

const websiteEnv = vi.hoisted(() => ({ WXT_WEBSITE_URL: "https://www.translatebuff.com" }))
vi.mock("@/env", () => ({ env: websiteEnv }))
vi.mock("@/fork/message", () => ({
  onForkMessage: vi.fn<() => void>(),
  sendForkMessage: vi.fn<() => Promise<string>>(),
}))

const storageGet = vi.fn<() => Promise<Record<string, unknown>>>()
const storageSet = vi.fn<() => Promise<void>>()

beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  vi.mocked(onForkMessage).mockReset()
  vi.mocked(sendForkMessage).mockReset()
  websiteEnv.WXT_WEBSITE_URL = "https://www.translatebuff.com"
  vi.stubEnv("WXT_FORK_EDITION", "global")
  vi.stubEnv("WXT_FORK_CHANNEL", "global-edge")
  storageGet.mockReset().mockResolvedValue({
    fork_install_channel_v1: {
      version: 1,
      installAt: 101,
      selectedCid: "7154",
      websiteOrigin: "https://www.translatebuff.com",
    },
  })
  storageSet.mockReset().mockResolvedValue(undefined)
  vi.spyOn(browser.storage.local, "get").mockImplementation(storageGet)
  vi.spyOn(browser.storage.local, "set").mockImplementation(storageSet)
  vi.spyOn(browser.cookies, "get").mockResolvedValue({ value: "9899" } as never)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("当前官网 Cookie 渠道优先", () => {
  it.each([
    ["global", "global-edge", "https://www.translatebuff.com"],
    ["cn", "edge", "https://www.translatebuff.cn"],
    ["global", "global-edge", "https://test.translatebuff.com"],
  ])("%s 请求优先使用当前环境的 aitrans_cid=9899", async (edition, channel, website) => {
    vi.stubEnv("WXT_FORK_EDITION", edition)
    vi.stubEnv("WXT_FORK_CHANNEL", channel)
    websiteEnv.WXT_WEBSITE_URL = website
    const { getSelectedChannelNumber } = await import("../install-channel-runtime")
    expect(await getSelectedChannelNumber()).toBe("9899")
    expect(browser.cookies.get).toHaveBeenCalledWith({ url: `${website}/`, name: "aitrans_cid" })
  })

  it("Cookie 改号立即用于下一次读取，删除后回到包内号，不继承旧固定记录", async () => {
    const { getSelectedChannelNumber } = await import("../install-channel-runtime")
    expect(await getSelectedChannelNumber()).toBe("9899")
    vi.mocked(browser.cookies.get).mockResolvedValue({ value: "66666" } as never)
    expect(await getSelectedChannelNumber()).toBe("66666")
    vi.mocked(browser.cookies.get).mockResolvedValue(null as never)
    expect(await getSelectedChannelNumber()).toBe("7152")
    expect(storageGet).not.toHaveBeenCalled()
    expect(storageSet).not.toHaveBeenCalled()
  })

  it.each(["empty", "error", "missing"])("Cookie %s 时使用包内号", async (state) => {
    if (state === "error") vi.mocked(browser.cookies.get).mockRejectedValue(new Error("denied"))
    else if (state === "empty")
      vi.mocked(browser.cookies.get).mockResolvedValue({ value: "" } as never)
    else vi.mocked(browser.cookies.get).mockResolvedValue(null as never)
    const { getBackgroundInstallChannel } = await import("../install-channel-runtime")
    expect(await getBackgroundInstallChannel()).toBe("7152")
  })

  it("Cookie 读取超时后放行请求，下一次可恢复读取", async () => {
    vi.useFakeTimers()
    vi.mocked(browser.cookies.get).mockImplementationOnce(() => new Promise(() => {}))
    const { getBackgroundInstallChannel } = await import("../install-channel-runtime")
    const pending = getBackgroundInstallChannel()
    await vi.advanceTimersByTimeAsync(1500)
    expect(await pending).toBe("7152")
    expect(await getBackgroundInstallChannel()).toBe("9899")
  })

  it.each(["cn", "global"])("%s 初始化注册页面读取消息", async (edition) => {
    vi.stubEnv("WXT_FORK_EDITION", edition)
    vi.stubEnv("WXT_FORK_CHANNEL", edition === "cn" ? "edge" : "global-edge")
    const { setupInstallChannel } = await import("../install-channel-runtime")
    setupInstallChannel()
    expect(onForkMessage).toHaveBeenCalledWith("forkGetInstallChannel", expect.any(Function))
    const handler = vi.mocked(onForkMessage).mock.calls[0]![1]
    expect(await handler({} as never)).toBe("9899")
  })

  it("页面每次询问后台，消息失败时读取 Cookie，不使用旧记录", async () => {
    vi.stubGlobal("window", {})
    vi.mocked(sendForkMessage)
      .mockResolvedValueOnce("9899")
      .mockResolvedValueOnce("66666")
      .mockRejectedValueOnce(new Error("background unavailable"))
    const { getSelectedChannelNumber } = await import("../install-channel-runtime")
    expect(await getSelectedChannelNumber()).toBe("9899")
    expect(await getSelectedChannelNumber()).toBe("66666")
    expect(await getSelectedChannelNumber()).toBe("9899")
    expect(storageGet).not.toHaveBeenCalled()
  })

  it("会员及 report 请求等待当前 Cookie，第 4 段随 Cookie 改变而版本仍为 1.5.0", async () => {
    let finishCookie!: (cookie: { value: string }) => void
    vi.mocked(browser.cookies.get).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCookie = resolve
        }) as never,
    )
    const { postClickEvent } = await import("@/fork/analytics/report-client")
    const fetchMock = vi
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue({ status: 200, json: async () => ({ mobile: "123" }) })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("WXT_REPORT_API_URL", "https://report.example")
    vi.stubEnv("WXT_RENYIMIAO_AUTH_BFF_URL", "https://auth.example")
    const report = postClickEvent([{ click_name: "app_start_up" }], {
      loginCredential: null,
      clientLanguage: "en-us",
    })
    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(browser.cookies.get).toHaveBeenCalled()
    finishCookie({ value: "9899" })
    await report
    expect(fetchMock.mock.calls[0]![1].headers.Useragent.split("/")[3]).toBe("9899")
    expect(fetchMock.mock.calls[0]![1].headers.Useragent.split("/")[5]).toBe("1.5.0")
    vi.mocked(browser.cookies.get).mockResolvedValue({ value: "66666" } as never)
    const { fetchLoginStatus } = await import("@/fork/membership/api")
    await fetchLoginStatus("credential")
    expect(fetchMock.mock.calls[1]![1].headers.Useragent.split("/")[3]).toBe("66666")
    expect(fetchMock.mock.calls[1]![1].headers.Useragent.split("/")[5]).toBe("1.5.0")
  })
})
