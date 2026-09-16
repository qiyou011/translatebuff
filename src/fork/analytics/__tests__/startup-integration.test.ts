import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { clearForkSession, loadForkSession, saveForkSession } from "@/fork/membership/session"
import { clearLastReportedDate } from "../active-dedup"

vi.mock("@/env", () => ({
  env: { WXT_OFFICIAL_SITE_ORIGINS: ["https://translatebuff.cn", "https://www.translatebuff.cn"] },
}))
vi.mock("@/utils/i18n/locale-map", () => ({ resolveUiLocale: () => "en" }))
vi.mock("@/fork/background/membership", () => ({ setupMembership: vi.fn<() => void>() }))
vi.mock("@/fork/background/repair-custom-actions", () => ({
  repairCustomActions: vi.fn<() => void>(),
}))
vi.mock("@/fork/message", () => ({ onForkMessage: vi.fn<() => void>() }))

const { setupFork } = await import("@/fork/background")
const { reportTranslateActive } = await import("../track-active")
const fetchMock = vi.fn<(...args: any[]) => Promise<any>>()
let cookie: { value: string } | null
let installed: (details: { reason: string }) => void
let startup: () => void
const NOW = 1789473600000
const SN = "b7e2c9a1-4f3d-4a80-9c17-2ee5d0f1a6b4"

beforeEach(async () => {
  await clearForkSession()
  await clearLastReportedDate()
  cookie = { value: SN }
  installed = () => {}
  startup = () => {}
  vi.spyOn(Date, "now").mockReturnValue(NOW)
  vi.spyOn(browser.runtime.onInstalled, "addListener").mockImplementation((fn) => {
    installed = fn as typeof installed
  })
  vi.spyOn(browser.runtime.onStartup, "addListener").mockImplementation((fn) => {
    startup = fn
  })
  vi.spyOn(browser.cookies, "get").mockImplementation(async () => cookie as never)
  vi.spyOn(browser.cookies, "set").mockImplementation(async (details) => {
    cookie = { value: details.value! }
    return cookie as never
  })
  fetchMock.mockReset().mockResolvedValue({ status: 200 })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("WXT_REPORT_API_URL", "https://report.test.local")
  vi.stubEnv("WXT_FORK_EDITION", "cn")
  vi.stubEnv("WXT_FORK_CHANNEL", "chrome-store")
  setupFork()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function events(count = 1) {
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(count))
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body)[0])
}

it.each(["install", "update", "startup"])(
  "%s 发送生命周期字段、触发时间与 fork 版本",
  async (reason) => {
    if (reason === "startup") startup()
    else installed({ reason })
    vi.mocked(Date.now).mockReturnValue(NOW + 5000)
    const [event] = await events()
    expect(event).toEqual({
      trace_id: expect.stringMatching(
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,
      ),
      click_name: "app_start_up",
      click_time: NOW,
      event_type: "lifecycle",
      client_type: 10,
      product_line: "AITRANS",
      client_version: "1.4.0",
      device_info: { sn: SN },
      action_extra_info: { launch_type: reason, launch_channel_id: 7101 },
    })
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://report.test.local/api/data_report/v1/client/click_event",
    )
    expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty("Login-Credential")
  },
)

it("普通后台初始化、浏览器和共享模块更新均不报", async () => {
  installed({ reason: "chrome_update" })
  installed({ reason: "browser_update" })
  installed({ reason: "shared_module_update" })
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(fetchMock).not.toHaveBeenCalled()
})

it("并发启动/活跃只创建一个持久 Cookie，活跃日去重不变", async () => {
  cookie = null
  startup()
  await reportTranslateActive(NOW)
  const result = await events(2)
  expect(result.map((e) => e.click_name).sort((a, b) => a.localeCompare(b))).toEqual([
    "app_start_up",
    "translate_active",
  ])
  expect(result[0].device_info.sn).toBeTruthy()
  expect(result[0].device_info).toEqual(result[1].device_info)
  expect(browser.cookies.set).toHaveBeenCalledTimes(1)
  expect(browser.cookies.set).toHaveBeenCalledWith({
    url: "https://translatebuff.cn",
    name: "translatebuff_device_sn",
    value: result[0].device_info.sn,
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    expirationDate: NOW / 1000 + 400 * 86400,
  })
  await reportTranslateActive(NOW + 1000)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  startup()
  await events(3)
  expect(browser.cookies.set).toHaveBeenCalledTimes(1)
})

it.each(["get", "set"] as const)("Cookie %s 失败降级空设备信息，活跃也继续报", async (method) => {
  cookie = null
  vi.mocked(browser.cookies[method]).mockRejectedValue(new Error("unavailable"))
  startup()
  await reportTranslateActive(NOW)
  expect((await events(2)).map((e) => e.device_info)).toEqual([{}, {}])
})

it("Cookie set 未写入时不发送临时 sn", async () => {
  cookie = null
  vi.mocked(browser.cookies.set).mockResolvedValue(undefined)
  startup()
  expect((await events())[0].device_info).toEqual({})
})

it("读取存量 Cookie，清除后生成新标识，不使用永久内存缓存", async () => {
  startup()
  expect((await events())[0].device_info).toEqual({ sn: SN })
  cookie = null
  startup()
  const result = await events(2)
  expect(result[1].device_info.sn).toBeTruthy()
  expect(result[1].device_info.sn).not.toBe(SN)
})

it("海外渠道仍为 AITRANS，数值渠道进入 extra", async () => {
  vi.stubEnv("WXT_FORK_EDITION", "global")
  vi.stubEnv("WXT_FORK_CHANNEL", "global-firefox")
  startup()
  const [event] = await events()
  expect(event.product_line).toBe("AITRANS")
  expect(event.action_extra_info.launch_channel_id).toBe(7153)
})

it.each([401, 500, "network"])("登录用户上报失败 %s 不重试、不登出", async (status) => {
  await saveForkSession({ loginCredential: "test-credential", phone: "test-user", user: {} })
  if (status === "network") fetchMock.mockRejectedValue(new Error("offline"))
  else fetchMock.mockResolvedValue({ status })
  startup()
  await events()
  expect(fetchMock.mock.calls[0]![1].headers["Login-Credential"]).toBe("test-credential")
  expect((await loadForkSession())?.loginCredential).toBe("test-credential")
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
