import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildAuthHeaders,
  fetchGatewayModels,
  fetchLoginStatus,
  fetchTokens,
  fetchTokensWithRetry,
  MembershipUnauthorizedError,
} from "../api"

const API_BASE = "https://api.test.local"
const CRED = "cred-abc-123"
const SK = "sk-mock-renyimiao-0000000000000000000000"

const fetchMock = vi.fn<(...args: any[]) => any>()

// 构造一个 fetch 响应替身：status + 可解析的 json 体。
function jsonResponse(status: number, body: unknown) {
  return {
    status,
    json: vi.fn<(...args: any[]) => any>().mockResolvedValue(body),
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("WXT_RENYIMIAO_API_URL", API_BASE)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("buildAuthHeaders（显式请求头装配）", () => {
  it("凭据与平台标识头齐全", () => {
    const headers = buildAuthHeaders(CRED)
    expect(headers["Login-Credential"]).toBe(CRED)
    expect(headers["Saas-Product-Line"]).toBe("AITRANS")
    expect(headers["Saas-App-Id"]).toBe("aitrans-pc")
    expect(headers["Client-Language"]).toBe("zh-cn")
  })

  it("Useragent 恰为 7 段，首段 browser、第 5 段 client_name=aitrans-pc", () => {
    const segments = buildAuthHeaders(CRED).Useragent.split("/")
    expect(segments).toHaveLength(7)
    expect(segments[0]).toBe("browser")
    expect(segments[3]).toBe("18790") // 渠道号：官网确认真值（后端 curl 示例已验证）
    expect(segments[4]).toBe("aitrans-pc")
  })

  it("只产出请求头、不含 credentials 字段（显式带头、不 include）", () => {
    const headers = buildAuthHeaders(CRED)
    expect("credentials" in headers).toBe(false)
  })
})

describe("fetchLoginStatus（取用户信息）", () => {
  it("解包 envelope，取 member.mobile 为手机号、member 为 user", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: { member: { mobile: "13800000000", nickname: "小明" } } }),
    )
    const result = await fetchLoginStatus(CRED)
    expect(result.phone).toBe("13800000000")
    expect(result.user).toMatchObject({ nickname: "小明" })
  })

  it("显式带 Login-Credential 头、且不带 credentials:include", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { member: { mobile: "138" } } }))
    await fetchLoginStatus(CRED)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/common_bll/v2/member/login_status`)
    expect(init.headers["Login-Credential"]).toBe(CRED)
    expect(init.credentials).toBeUndefined()
  })

  it("401 抛 MembershipUnauthorizedError", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}))
    await expect(fetchLoginStatus(CRED)).rejects.toBeInstanceOf(MembershipUnauthorizedError)
  })

  it("非 2xx(如 500) 抛错、不误判为成功（防写出空手机号幽灵会话）", async () => {
    // 服务端出错但回 JSON 错误信封：修前会被当成功解析成 {phone:"",user:错误体} 幽灵会话；修后应抛错。
    fetchMock.mockResolvedValue({
      status: 500,
      statusText: "Server Error",
      json: () => Promise.resolve({ data: null, error_msg: "boom" }),
      text: () => Promise.resolve(""),
    })
    await expect(fetchLoginStatus(CRED)).rejects.toThrow(/500/)
  })
})

describe("fetchTokens（取 sk_key）", () => {
  it("取首个 token 的 sk_key，并携带完整原始 tokens 数组（供会员信息派生）", async () => {
    const rawTokens = [{ sk_key: SK, token_name: "subscription", priority: 50 }]
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: { base_url: "https://gw", tokens: rawTokens } }),
    )
    expect(await fetchTokens(CRED)).toEqual({ skKey: SK, baseUrl: "https://gw", tokens: rawTokens })
  })

  it("tokens 为空 → null（开户未完成）", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { base_url: "https://gw", tokens: [] } }))
    expect(await fetchTokens(CRED)).toBeNull()
  })

  it("命中 claw_bff/v1/tokens 端点、显式带头", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { tokens: [{ sk_key: SK }] } }))
    await fetchTokens(CRED)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/claw_bff/v1/tokens`)
    expect(init.headers["Login-Credential"]).toBe(CRED)
    expect(init.credentials).toBeUndefined()
  })

  it("401 抛 MembershipUnauthorizedError", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}))
    await expect(fetchTokens(CRED)).rejects.toBeInstanceOf(MembershipUnauthorizedError)
  })

  it("非 2xx(如 503) 抛错、不当成 tokens 空（防静默卡「正在获取密钥」）", async () => {
    // 修前 503 错误信封被 unwrap 成无 tokens 字段 → 当成「开户未完成」返回 null；修后应抛错。
    fetchMock.mockResolvedValue({
      status: 503,
      statusText: "Unavailable",
      json: () => Promise.resolve({ data: null, error_msg: "boom" }),
      text: () => Promise.resolve(""),
    })
    await expect(fetchTokens(CRED)).rejects.toThrow(/503/)
  })
})

describe("fetchTokensWithRetry（开户轮询）", () => {
  const noSleep = () => Promise.resolve()

  it("首次即得 → 不轮询", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { tokens: [{ sk_key: SK }] } }))
    const result = await fetchTokensWithRetry(CRED, { sleep: noSleep })
    expect(result).toMatchObject({ skKey: SK, baseUrl: "" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("首次空、轮询第 2 次拿到即停", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: { tokens: [] } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { tokens: [] } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { tokens: [{ sk_key: SK }] } }))
    const result = await fetchTokensWithRetry(CRED, { sleep: noSleep })
    expect(result).toMatchObject({ skKey: SK, baseUrl: "" })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("轮询到上限仍空 → null（首次 + 最多 3 次 = 4 次请求）", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { tokens: [] } }))
    const result = await fetchTokensWithRetry(CRED, { sleep: noSleep })
    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("轮询中 401 直接抛出、不再重试（供上层清态捕获）", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: { tokens: [] } }))
      .mockResolvedValueOnce(jsonResponse(401, {}))
    await expect(fetchTokensWithRetry(CRED, { sleep: noSleep })).rejects.toBeInstanceOf(
      MembershipUnauthorizedError,
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("fetchGatewayModels（拉网关可用模型）", () => {
  it("GET {baseUrl}/models 带 Bearer sk_key，取 data[].id", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: [{ id: "Deepseek-V4-Pro" }, { id: "GLM-5.2" }] }),
    )
    const ids = await fetchGatewayModels("https://gw/v1", SK)
    expect(ids).toEqual(["Deepseek-V4-Pro", "GLM-5.2"])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://gw/v1/models")
    expect(init.headers.Authorization).toBe(`Bearer ${SK}`)
  })

  it("空 data / 缺 id → 过滤为可用 id 列表", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ id: "A" }, {}, { id: "" }] }))
    expect(await fetchGatewayModels("https://gw/v1", SK)).toEqual(["A"])
  })

  it("非 2xx → 抛错（供上层降级捕获，不阻断登录）", async () => {
    fetchMock.mockResolvedValue({
      status: 500,
      statusText: "Server Error",
      text: () => Promise.resolve(""),
    })
    await expect(fetchGatewayModels("https://gw/v1", SK)).rejects.toThrow(/500/)
  })
})
