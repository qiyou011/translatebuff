import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildAuthHeaders,
  fetchGatewayModels,
  fetchLoginStatus,
  fetchTokens,
  fetchTokensWithRetry,
  MembershipUnauthorizedError,
} from "../api"
import { DEFAULT_CLIENT_LANGUAGE } from "../client-language"

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
    expect(headers["Client-Language"]).toBe("en-us")
  })

  it("Client-Language 由第二参决定（中文界面仍发 zh-cn，国内线不回归）", () => {
    expect(buildAuthHeaders(CRED, "zh-cn")["Client-Language"]).toBe("zh-cn")
    expect(buildAuthHeaders(CRED, "ja-jp")["Client-Language"]).toBe("ja-jp")
  })

  it("不传第二参 → 回落 DEFAULT_CLIENT_LANGUAGE（已知可用的英文）", () => {
    expect(buildAuthHeaders(CRED)["Client-Language"]).toBe(DEFAULT_CLIENT_LANGUAGE)
  })

  it("Useragent 恰为 7 段，首段 browser、第 5 段 client_name=aitrans-pc", () => {
    const segments = buildAuthHeaders(CRED).Useragent!.split("/")
    expect(segments).toHaveLength(7)
    expect(segments[0]).toBe("browser")
    expect(segments[3]).toBe("7100") // 渠道号
    expect(segments[4]).toBe("aitrans-pc")
  })

  it("只产出请求头、不含 credentials 字段（显式带头、不 include）", () => {
    const headers = buildAuthHeaders(CRED)
    expect("credentials" in headers).toBe(false)
  })

  it("段4 渠道号取自 resolveChannelNumber：stubEnv=zip → 仍为 7100", () => {
    vi.stubEnv("WXT_FORK_CHANNEL", "zip")
    const segments = buildAuthHeaders(CRED).Useragent!.split("/")
    expect(segments[3]).toBe("7100")
  })

  it("段4 随渠道解析：stubEnv=chrome-store → 段4=7101（随渠道变，不再恒为 7100）", () => {
    vi.stubEnv("WXT_FORK_CHANNEL", "chrome-store")
    const segments = buildAuthHeaders(CRED).Useragent!.split("/")
    expect(segments[3]).toBe("7101")
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
    const [url, init] = fetchMock.mock.calls[0]!
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
    const [url, init] = fetchMock.mock.calls[0]!
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

describe("edition 分流：登录后端与 claw_bff 基址", () => {
  const AUTH_BFF = "https://lrbff.test.local"
  const CLAW_BASE = "https://claw.test.local"

  // 海外线凭据由 third_party_login 签发、经 lrbff 中转，common_bll 只在带 BFF 换发的 SaaS Token
  // 上下文里才认；插件直连必然 401。故 global 走 BFF，cn 保持直连（凭据由 common_bll 自签自认）。
  it("global：login_status 走 lrbff 的 session 端点", async () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    vi.stubEnv("WXT_RENYIMIAO_AUTH_BFF_URL", AUTH_BFF)
    vi.stubEnv("WXT_RENYIMIAO_CLAW_API_URL", CLAW_BASE)
    fetchMock.mockResolvedValue(jsonResponse(200, { mobile: "", email: "a@b.com" }))
    await fetchLoginStatus(CRED)
    expect(fetchMock.mock.calls[0]![0]).toBe(`${AUTH_BFF}/api/login_registration_bff/v1/session`)
  })

  it("cn：login_status 保持直连 common_bll（既有行为逐字不变）", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { member: { mobile: "13800000000" } } }))
    await fetchLoginStatus(CRED)
    expect(fetchMock.mock.calls[0]![0]).toBe(`${API_BASE}/api/common_bll/v2/member/login_status`)
  })

  // 两线 claw_bff 是不同实例（国内 cbs1sit / 海外 tobtest，依据两个官网仓的 .env.test），
  // 且 lrbff 路由表无 tokens 接口、无法经 BFF 取。
  it("global：tokens 走独立的 claw 基址", async () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    vi.stubEnv("WXT_RENYIMIAO_AUTH_BFF_URL", AUTH_BFF)
    vi.stubEnv("WXT_RENYIMIAO_CLAW_API_URL", CLAW_BASE)
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { tokens: [{ sk_key: SK }] } }))
    await fetchTokens(CRED)
    expect(fetchMock.mock.calls[0]![0]).toBe(`${CLAW_BASE}/api/claw_bff/v1/tokens`)
  })

  it("cn：tokens 回落 apiBase（两线同域是 cn 的既有事实）", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { tokens: [{ sk_key: SK }] } }))
    await fetchTokens(CRED)
    expect(fetchMock.mock.calls[0]![0]).toBe(`${API_BASE}/api/claw_bff/v1/tokens`)
  })

  // fail-loud：global 缺配绝不静默回落到 cn 的后端——那正是本轮排查了一整轮的失败形态
  // （打错 host → 401 → 清态，全程零信号）。对齐 resolveChannelNumber 的既有模式。
  it("global 缺 auth BFF 地址 → 抛错，绝不静默回落", async () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    vi.stubEnv("WXT_RENYIMIAO_CLAW_API_URL", CLAW_BASE)
    await expect(fetchLoginStatus(CRED)).rejects.toThrow(/WXT_RENYIMIAO_AUTH_BFF_URL/)
  })

  it("global 缺 claw 地址 → 抛错，绝不静默回落", async () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    vi.stubEnv("WXT_RENYIMIAO_AUTH_BFF_URL", AUTH_BFF)
    await expect(fetchTokens(CRED)).rejects.toThrow(/WXT_RENYIMIAO_CLAW_API_URL/)
  })

  // lrbff 的 compactSession 返回扁平体（无 data 封套），common_bll 返回 {member:{...}} 嵌套。
  it("解析兼容两种响应形状，并取出 email", async () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    vi.stubEnv("WXT_RENYIMIAO_AUTH_BFF_URL", AUTH_BFF)
    vi.stubEnv("WXT_RENYIMIAO_CLAW_API_URL", CLAW_BASE)
    fetchMock.mockResolvedValue(
      jsonResponse(200, { member_id: "m1", mobile: "", email: "alice@gmail.com" }),
    )
    expect(await fetchLoginStatus(CRED)).toMatchObject({ phone: "", email: "alice@gmail.com" })
  })

  it("cn 嵌套形状下 email 缺失 → 空串，不炸", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { member: { mobile: "13800000000" } } }))
    expect(await fetchLoginStatus(CRED)).toMatchObject({ phone: "13800000000", email: "" })
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
    const [url, init] = fetchMock.mock.calls[0]!
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
