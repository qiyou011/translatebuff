import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"

vi.mock("@/env", () => ({ env: { WXT_WEBSITE_URL: "https://www.translatebuff.com" } }))
vi.mock("@/fork/message", () => ({
  onForkMessage: vi.fn<() => void>(),
  sendForkMessage: vi.fn<() => Promise<string>>(),
}))

const listeners: Array<(details: { reason: string }) => void> = []

beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  listeners.length = 0
  vi.stubEnv("WXT_FORK_EDITION", "global")
  vi.stubEnv("WXT_FORK_CHANNEL", "global-chrome-store")
  vi.spyOn(browser.runtime.onInstalled, "addListener").mockImplementation((fn) => {
    listeners.push(fn as (details: { reason: string }) => void)
  })
  vi.spyOn(browser.storage.local, "get").mockResolvedValue({} as never)
  vi.spyOn(browser.storage.local, "set").mockResolvedValue(undefined)
  vi.spyOn(browser.cookies, "get").mockResolvedValue({
    value: "{%22cid%22:%227154%22%2C%22recordedAt%22:100}",
  } as never)
})

describe("安装渠道后台门禁", () => {
  it("海外 Edge 新装不从普通 aitrans_cid=66666 推断推广渠道", async () => {
    vi.stubEnv("WXT_FORK_CHANNEL", "global-edge")
    vi.mocked(browser.cookies.get).mockImplementation(async ({ name }) =>
      name === "aitrans_cid" ? ({ value: "66666" } as never) : null,
    )
    const { setupInstallChannel, getBackgroundInstallChannel } =
      await import("../install-channel-runtime")
    setupInstallChannel()
    listeners[0]!({ reason: "install" })

    expect(await getBackgroundInstallChannel()).toBe("7152")
    expect(browser.cookies.get).toHaveBeenCalledTimes(1)
    expect(browser.cookies.get).toHaveBeenCalledWith({
      url: "https://www.translatebuff.com/",
      name: "aitrans_install_promo",
    })
  })

  it("安装事件先同步固定时间，首发读取等待推广决策", async () => {
    const { setupInstallChannel, getBackgroundInstallChannel } =
      await import("../install-channel-runtime")
    const now = vi.spyOn(Date, "now").mockReturnValue(101)
    const setSpy = vi.spyOn(browser.storage.local, "set")
    setupInstallChannel()
    listeners[0]!({ reason: "install" })
    now.mockReturnValue(999)

    expect(await getBackgroundInstallChannel()).toBe("7154")
    expect(browser.cookies.get).toHaveBeenCalledWith({
      url: "https://www.translatebuff.com/",
      name: "aitrans_install_promo",
    })
    expect(setSpy.mock.calls[0]?.[0]).toEqual({
      fork_install_channel_v1: {
        version: 1,
        installAt: 101,
        selectedCid: "7154",
        websiteOrigin: "https://www.translatebuff.com",
      },
    })
  })

  it("普通冷启动无固定记录时直接用包内号且不碰推广 cookie", async () => {
    const { setupInstallChannel, getBackgroundInstallChannel } =
      await import("../install-channel-runtime")
    setupInstallChannel()
    expect(await getBackgroundInstallChannel()).toBe("7151")
    expect(browser.cookies.get).not.toHaveBeenCalled()
  })

  it("本地存储写入不返回时仍放行安装上报渠道", async () => {
    vi.spyOn(browser.storage.local, "set").mockImplementation(
      () => new Promise<void>(() => {}) as never,
    )
    const { setupInstallChannel, getBackgroundInstallChannel } =
      await import("../install-channel-runtime")
    vi.spyOn(Date, "now").mockReturnValue(101)
    setupInstallChannel()
    listeners[0]!({ reason: "install" })
    await expect(getBackgroundInstallChannel()).resolves.toBe("7154")
  })

  it("存量 update 不补认官网推广", async () => {
    const { setupInstallChannel, getBackgroundInstallChannel } =
      await import("../install-channel-runtime")
    setupInstallChannel()
    listeners[0]!({ reason: "update" })
    expect(await getBackgroundInstallChannel()).toBe("7151")
    expect(browser.cookies.get).not.toHaveBeenCalled()
  })

  it("report 首发请求等待安装渠道决策，Useragent 与固定号一致", async () => {
    let finishCookie!: (cookie: { value: string }) => void
    vi.mocked(browser.cookies.get).mockImplementation(
      () =>
        new Promise<{ value: string }>((resolve) => {
          finishCookie = resolve
        }) as never,
    )
    const { setupInstallChannel } = await import("../install-channel-runtime")
    const { postClickEvent } = await import("@/fork/analytics/report-client")
    const fetchMock = vi
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue({ status: 200, json: async () => ({ mobile: "123" }) })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("WXT_REPORT_API_URL", "https://report.example")
    vi.stubEnv("WXT_RENYIMIAO_AUTH_BFF_URL", "https://auth.example")
    vi.spyOn(Date, "now").mockReturnValue(101)
    setupInstallChannel()
    listeners[0]!({ reason: "install" })
    const report = postClickEvent([{ click_name: "app_start_up" }], {
      loginCredential: null,
      clientLanguage: "en-us",
    })
    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
    finishCookie({ value: "{%22cid%22:%227154%22%2C%22recordedAt%22:100}" })
    await report
    expect(fetchMock.mock.calls[0]![1].headers.Useragent.split("/")[3]).toBe("7154")
    const { fetchLoginStatus } = await import("@/fork/membership/api")
    await fetchLoginStatus("credential")
    expect(fetchMock.mock.calls[1]![1].headers.Useragent.split("/")[3]).toBe("7154")
    vi.unstubAllGlobals()
  })
})
