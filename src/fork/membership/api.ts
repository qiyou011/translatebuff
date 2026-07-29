// 任译喵平台会员 API 客户端（common_bll 取用户信息 / claw_bff 取 one-api sk_key）。
// 逐字对齐参考实现 aimanager-app（code/aimanager-app/src/_app/lib/auth/api.ts + http/config.ts）：
//   · 凭据永远显式塞 `Login-Credential` 头，绝不 credentials:include——mock 同域与真态跨域走同一路径（设计 D3）。
//   · 平台响应 envelope 统一 `{ data: {...} }`，取内层（对齐参考 client 的 `data.data ?? data`）。
//   · API 基址直读 `import.meta.env.WXT_RENYIMIAO_API_URL`（绕 t3-env、不改 src/env，保 fork 边界，设计 D4）。
//     用函数读取（非模块顶层快照）：生产由 Vite 编译期注入，单测用 vi.stubEnv 运行期改它，函数读保证读到当前值。

import type { RawToken } from "./tier"
import { resolveChannelNumber } from "@/fork/identity/channel"
import { extractErrorMessage } from "@/utils/error/extract-message"

// ── 平台标识常量（固定值）──
const SAAS_PRODUCT_LINE = "AITRANS"
const SAAS_APP_ID = "aitrans-pc" // 亦即 7 段 UA 的 client_name 段（对齐参考 SAAS_APP_ID）
const CLIENT_LANGUAGE = "zh-cn" // 全小写（对齐参考 CLIENT_LANGUAGE）

// ── 7 段 Useragent 常量（格式：browser/{os}/{osVersion}/{channel}/aitrans-pc/{appVersion}/{sn}）──
// 取值对齐官网确认的跨仓契约（translatebuff-web src/lib/service/const.ts 的 UA_STRING / CHANNEL_KEY，
// 后端 curl 示例已验证）。扩展无原生层拿真实 os/sn，故镜像官网 web 端的已知可用值；
// 未来接真实 per-device os/版本/identity 版本可作精化，不影响本迭代对接。
// 段4 渠道号不再硬编码：由 resolveChannelNumber() 按构建期渠道解析（多渠道归因，见 fork/identity/channel）。
const UA_DEVICE_NAME = "browser" // 段1：固定 browser（对齐官网 web 端 UA 首段）
const UA_OS = "Windows" // 段2：os —— 镜像官网确认值
const UA_OS_VERSION = "windows10.0.22621.2792x64" // 段3：osVersion —— 镜像官网确认值
const UA_APP_VERSION = "1.0.0" // 段6：appVersion —— 镜像官网确认值
const UA_SN = "000000000000" // 段7：sn 设备唯一标识 —— 扩展无硬件 ID，回落官网占位值

// 组装 7 段 UA。各段均不含 `/`，保证后端按 `/` split 恒得 7 段。段4 渠道号函数内解析（非模块顶层快照）。
function buildUserAgent(): string {
  return `${UA_DEVICE_NAME}/${UA_OS}/${UA_OS_VERSION}/${resolveChannelNumber()}/${SAAS_APP_ID}/${UA_APP_VERSION}/${UA_SN}`
}

// 显式请求头装配（纯函数）：凭据 + 平台标识 + 7 段 UA + 语言。绝不含 credentials（由调用方保证不 include）。
export function buildAuthHeaders(loginCredential: string): Record<string, string> {
  return {
    "Login-Credential": loginCredential,
    "Saas-Product-Line": SAAS_PRODUCT_LINE,
    "Saas-App-Id": SAAS_APP_ID,
    Useragent: buildUserAgent(),
    "Client-Language": CLIENT_LANGUAGE,
  }
}

// 401：凭据过期/失效。上层据此走端到端清态（清 session + 清 key）。
export class MembershipUnauthorizedError extends Error {
  constructor(message = "membership credential unauthorized (401)") {
    super(message)
    this.name = "MembershipUnauthorizedError"
  }
}

// 平台 API 基址（登录后端域，≠ RENYIMIAO_GATEWAY_BASE_URL 翻译网关）。函数读取以可测。
function apiBase(): string {
  return import.meta.env.WXT_RENYIMIAO_API_URL as string
}

// 解 envelope：后端多层 `{ data: {...} }`，取内层；无 data 字段则原样返回（对齐参考 `data.data ?? data`）。
function unwrap(json: unknown): Record<string, unknown> {
  if (json && typeof json === "object") {
    const record = json as Record<string, unknown>
    // typeof null === "object"，故显式排除 null；undefined 的 typeof 为 "undefined" 已被排除。
    if (record.data !== null && typeof record.data === "object") {
      return record.data as Record<string, unknown>
    }
    return record
  }
  return {}
}

export interface LoginStatusResult {
  phone: string
  // user 形状宽松（Open Question：以真接口/参考站 MemberData 为准），本迭代原样透传内层 member。
  user: Record<string, unknown>
}

// 显式带头的 authed GET：GET + buildAuthHeaders（绝不 credentials:include）+ 401 抛错 + unwrap envelope。
// 各 fetch* 共用样板收敛于此，401 语义只此一处。
async function authedGet(
  pathname: string,
  loginCredential: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiBase()}${pathname}`, {
    method: "GET",
    headers: buildAuthHeaders(loginCredential),
  })
  if (res.status === 401) {
    throw new MembershipUnauthorizedError()
  }
  // 非 2xx（401 之外的 500/403/429…）不得当成功解析：否则 login_status 的服务器错误被误判为登录成功、
  // 写出空手机号幽灵会话；/v1/tokens 被当成「开户未完成」静默卡「正在获取密钥」。与 fetchGatewayModels 状态守卫同构。
  if (res.status < 200 || res.status >= 300) {
    throw new Error(await extractErrorMessage(res))
  }
  return unwrap(await res.json())
}

// 取当前登录用户信息（手机号 + 用户资料）。401 由 authedGet 抛 MembershipUnauthorizedError。
export async function fetchLoginStatus(loginCredential: string): Promise<LoginStatusResult> {
  const data = await authedGet("/api/common_bll/v2/member/login_status", loginCredential)
  // 参考 LoginStatusResponse：{ member: { mobile, nickname, accounts } }。手机号取 member.mobile。
  const member = (data.member ?? data) as Record<string, unknown>
  const phone = typeof member.mobile === "string" ? member.mobile : ""
  return { phone, user: member }
}

export interface TokensResult {
  skKey: string
  /** oneapi 翻译网关地址（与 sk_key 同一 /v1/tokens 响应返回）。空则上层回落网关常量。 */
  baseUrl: string
  /** 完整原始 tokens 数组（加性字段，供会员信息按 priority 选主档派生 tier/到期/用量）。 */
  tokens: RawToken[]
}

// 取 one-api sk_key + 网关 base_url（一用户一 token，取首个 token 的 sk_key）。空 key→null；401 抛错。
// base_url 与 sk_key 同源（同一 /v1/tokens 响应），供动态注入 provider baseURL 与拉 /models 用。
export async function fetchTokens(loginCredential: string): Promise<TokensResult | null> {
  const data = await authedGet("/api/claw_bff/v1/tokens", loginCredential)
  // 参考 TokensResponse：{ base_url, tokens: [{ sk_key, token_name, priority, expired_time, ... }] }。
  const tokens = Array.isArray(data.tokens) ? (data.tokens as RawToken[]) : []
  const skKey = tokens[0]?.sk_key
  const baseUrl = typeof data.base_url === "string" ? data.base_url : ""
  // 加性：非 null 时一并带回完整 tokens 供会员派生（skKey 空→null 语义不变，供轮询）。
  return typeof skKey === "string" && skKey !== "" ? { skKey, baseUrl, tokens } : null
}

// 拉网关可用模型（openai 兼容 GET {baseUrl}/models）。
// 【注意鉴权不同】这是打「翻译网关」(base_url，来自 /v1/tokens)，非平台后端(WXT_RENYIMIAO_API_URL)——
// 故用 Authorization: Bearer <sk_key>，不带 Login-Credential/Saas 头（不同域、不同鉴权）。
// 选项页「更新模型」按钮与登录后台自动拉取共用此函数（单一 fetch 逻辑）。失败抛错，供上层降级捕获。
export async function fetchGatewayModels(baseUrl: string, skKey: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${skKey}` },
  })
  if (res.status < 200 || res.status >= 300) {
    throw new Error(await extractErrorMessage(res))
  }
  const data = (await res.json()) as { data?: Array<{ id?: unknown }> }
  const list = Array.isArray(data.data) ? data.data : []
  return list
    .map((model) => (typeof model.id === "string" ? model.id : ""))
    .filter((id) => id !== "")
}

export interface FetchTokensRetryOptions {
  /** 轮询重取次数（不含首次立即取），默认 3。 */
  maxRetries?: number
  /** 每次轮询间隔毫秒，默认 3000。 */
  retryDelayMs?: number
  /** 可注入延时（测试注入即时 resolve 免真实等待）。 */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// 开户轮询取 sk_key：首登开户为异步，/v1/tokens 首次可能空 → +3s 起、每 3s、最多 maxRetries 次，拿到即停。
//
// 【偏离设计 D6 说明】设计要求用 chrome.alarms 定时轮询；本实现改为「在 cookie onChanged 事件处理器内连续
// await 有界重试」，原因有二：
//   ① chrome.alarms 最小粒度为 30s（delayInMinutes 最小 0.5），无法满足 spec「每 3s」的轮询节奏；
//   ② 本文件不在 manifest 改动范围内（软 fork 边界：只改本任务 3 个文件），无法为 alarms 加 "alarms" 权限。
// 连续 await（不留空闲空档，最多 ~9s）使事件处理器返回的 promise 挂起，SW 在此期间保持存活；SW 若仍被回收，
// 由 R6「挂载补偿」（forkEnsureMembershipKey）幂等补拉兜底，闭环不依赖 SW 常驻。
export async function fetchTokensWithRetry(
  loginCredential: string,
  options: FetchTokensRetryOptions = {},
): Promise<TokensResult | null> {
  const { maxRetries = 3, retryDelayMs = 3000, sleep = defaultSleep } = options
  // 首次立即取（开户已完成的常态一次即得）。
  const first = await fetchTokens(loginCredential)
  if (first) {
    return first
  }
  // 首登开户异步 → +3s 起、每 3s、最多 maxRetries 次，任一次拿到即停。401 由 fetchTokens 直接抛出、不再重试。
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await sleep(retryDelayMs)
    const result = await fetchTokens(loginCredential)
    if (result) {
      return result
    }
  }
  return null
}
