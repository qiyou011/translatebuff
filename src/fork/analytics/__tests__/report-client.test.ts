import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CLICK_EVENT_PATH, buildReportHeaders, postClickEvent } from "../report-client"

const REPORT_BASE = "https://report.test.local"
const CRED = "cred-abc-123"
const EVENTS = [{ click_name: "translate_active" }]

const fetchMock = vi.fn<(...args: any[]) => any>()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ status: 200 })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("WXT_REPORT_API_URL", REPORT_BASE)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("上报请求装配", () => {
  it("打到中台不加密 click_event 接口，POST，body 恒为数组", async () => {
    await postClickEvent(EVENTS, { loginCredential: CRED, clientLanguage: "en-us" })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${REPORT_BASE}${CLICK_EVENT_PATH}`)
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual(EVENTS)
  })

  it("平台标识头齐全", () => {
    const headers = buildReportHeaders(CRED, "en-us")

    expect(headers["Saas-Product-Line"]).toBe("AITRANS")
    expect(headers["Saas-App-Id"]).toBe("aitrans-pc")
    expect(headers["Client-Language"]).toBe("en-us")
    expect(headers.Useragent).toBeTruthy()
  })

  it("有会话时带 Login-Credential", () => {
    expect(buildReportHeaders(CRED, "en-us")["Login-Credential"]).toBe(CRED)
  })

  it("未登录时该键不存在，而不是空字符串", () => {
    const headers = buildReportHeaders(null, "en-us")

    expect("Login-Credential" in headers).toBe(false)
  })
})

// 埋点绝不冒泡业务流：这三条一旦破了，翻译会因为一个埋点请求而报错。
describe("上报失败一律静默", () => {
  it("fetch reject 时不抛", async () => {
    fetchMock.mockRejectedValue(new Error("network down"))

    await expect(
      postClickEvent(EVENTS, { loginCredential: CRED, clientLanguage: "en-us" }),
    ).resolves.toBeUndefined()
  })

  it("返回 500 时不抛", async () => {
    fetchMock.mockResolvedValue({ status: 500 })

    await expect(
      postClickEvent(EVENTS, { loginCredential: CRED, clientLanguage: "en-us" }),
    ).resolves.toBeUndefined()
  })

  it("返回 401 时不抛，也不做任何清态", async () => {
    fetchMock.mockResolvedValue({ status: 401 })

    await expect(
      postClickEvent(EVENTS, { loginCredential: CRED, clientLanguage: "en-us" }),
    ).resolves.toBeUndefined()
    // 会员 client 的 401 语义是端到端清态；埋点走独立路径，绝不能触发它。
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("未配置上报域时直接跳过，不发请求", async () => {
    vi.stubEnv("WXT_REPORT_API_URL", "")

    await postClickEvent(EVENTS, { loginCredential: CRED, clientLanguage: "en-us" })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
