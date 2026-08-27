// 任译喵平台会员 API 客户端（common_bll 取用户信息 / claw_bff 取 one-api sk_key）。
// 逐字对齐参考实现 aimanager-app（code/aimanager-app/src/_app/lib/auth/api.ts + http/config.ts）：
//   · 凭据永远显式塞 `Login-Credential` 头，绝不 credentials:include——mock 同域与真态跨域走同一路径（设计 D3）。
//   · 平台响应 envelope 统一 `{ data: {...} }`，取内层（对齐参考 client 的 `data.data ?? data`）。
//   · API 基址直读 `import.meta.env.WXT_RENYIMIAO_API_URL`（绕 t3-env、不改 src/env，保 fork 边界，设计 D4）。
//     用函数读取（非模块顶层快照）：生产由 Vite 编译期注入，单测用 vi.stubEnv 运行期改它，函数读保证读到当前值。

import type { RawToken } from "./tier"
import { resolveChannelNumber } from "@/fork/identity/channel"
import { currentEdition } from "@/fork/identity/edition"
import { extractErrorMessage } from "@/utils/error/extract-message"
import { DEFAULT_CLIENT_LANGUAGE } from "./client-language"

// ── 平台标识常量（固定值）──
const SAAS_PRODUCT_LINE = "AITRANS"
const SAAS_APP_ID = "aitrans-pc" // 亦即 7 段 UA 的 client_name 段（对齐参考 SAAS_APP_ID）

// ── 7 段 Useragent 常量（格式：browser/{os}/{osVersion}/{channel}/aitrans-pc/{appVersion}/{sn}）──
// 取值对齐官网确认的跨仓契约（translatebuff-web src/lib/service/const.ts 的 UA_STRING / CHANNEL_KEY，
// 后端 curl 示例已验证）。扩展无原生层拿真实 os/sn，故镜像官网 web 端的已知可用值；
// 未来接真实 per-device os/版本/identity 版本可作精化，不影响本迭代对接。
// 段4 渠道号不再硬编码：由 resolveChannelNumber() 按构建期渠道解析（多渠道归因，见 fork/identity/channel）。
const UA_DEVICE_NAME = "browser" // 段1：固定 browser（对齐官网 web 端 UA 首段）
const UA_OS = "Windows" // 段2：os —— 镜像官网确认值
const UA_OS_VERSION = "windows10.0.22621.2792x64" // 段3：osVersion —— 镜像官网确认值
const UA_APP_VERSION = "1.0.1" // 段6：appVersion —— 跟随 fork 发版号手工同步
// ⚠️ 发新版改 fork-version.json 时，这里要一起改；没做成读真源是因为后端若对 appVersion
//    有校验/白名单，动态跟版会在发版当天静默挂掉登录——需要后端确认后才能改成自动。
const UA_SN = "000000000000" // 段7：sn 设备唯一标识 —— 扩展无硬件 ID，回落官网占位值

// 组装 7 段 UA。各段均不含 `/`，保证后端按 `/` split 恒得 7 段。段4 渠道号函数内解析（非模块顶层快照）。
function buildUserAgent(): string {
  return `${UA_DEVICE_NAME}/${UA_OS}/${UA_OS_VERSION}/${resolveChannelNumber()}/${SAAS_APP_ID}/${UA_APP_VERSION}/${UA_SN}`
}

// 显式请求头装配（纯函数）：凭据 + 平台标识 + 7 段 UA + 语言。绝不含 credentials（由调用方保证不 include）。
// clientLanguage 由调用方按当前界面语言算好传入（见 membership/client-language.ts）：后端按完整 locale
// 查错误消息译文、查不到不回退英文，故缺省取已知可用的 en-us 而非某条具体语种。
export function buildAuthHeaders(
  loginCredential: string,
  clientLanguage: string = DEFAULT_CLIENT_LANGUAGE,
): Record<string, string> {
  return {
    "Login-Credential": loginCredential,
    "Saas-Product-Line": SAAS_PRODUCT_LINE,
    "Saas-App-Id": SAAS_APP_ID,
    Useragent: buildUserAgent(),
    "Client-Language": clientLanguage,
  }
}

// 401：凭据过期/失效。上层据此走端到端清态（清 session + 清 key）。
export class MembershipUnauthorizedError extends Error {
  constructor(message = "membership credential unauthorized (401)") {
    super(message)
    this.name = "MembershipUnauthorizedError"
  }
}

// 平台 API 基址（common_bll，cn 线的登录后端域，≠ RENYIMIAO_GATEWAY_BASE_URL 翻译网关）。函数读取以可测。
// ⚠️ global 线已无运行期消费者（login_status 走 BFF、tokens 走 claw 独立实例），但 .env.global 里那一行
//    不能删——wxt zip 是 production 模式会自动读 .env.production，删了会回落成国内生产域并混进海外包。
function apiBase(): string {
  return import.meta.env.WXT_RENYIMIAO_API_URL as string
}

// edition 必填 env 的读取器：global 缺配即抛错，绝不静默回落到另一条线的后端。
// 与 resolveChannelNumber 同款 fail-loud —— 静默回落打错 host 的表现是「401 → 清态」，
// 全程零信号，正是本仓排查过一整轮的那个失败形态。
function requiredGlobalEnv(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`edition=global 缺少 ${key}（海外线后端与国内线不同，绝不回落）`)
  }
  return value
}

// login_status 的基址与路径。
// global：凭据由 third_party_login 签发、经 lrbff 中转，common_bll 只认带 BFF 换发 SaaS Token 的上下文，
//         插件直连必然 401 —— 故走 BFF 的 session 端点（它内部再转 common_bll 并补上 SaaS Token）。
// cn：    凭据由 common_bll 的 captcha_login 自签自认，直连即可，既有行为逐字不变。
function loginStatusTarget(): { base: string; pathname: string } {
  if (currentEdition() === "global") {
    return {
      base: requiredGlobalEnv(
        "WXT_RENYIMIAO_AUTH_BFF_URL",
        import.meta.env.WXT_RENYIMIAO_AUTH_BFF_URL as string | undefined,
      ),
      pathname: "/api/login_registration_bff/v1/session",
    }
  }
  return { base: apiBase(), pathname: "/api/common_bll/v2/member/login_status" }
}

// claw_bff 基址（sk_key / tokens）。两线是**不同实例**：国内 cbs1sit、海外 tobtest
// （依据两个官网仓 .env.test 的 NEXT_PUBLIC_CLAW_API_URL），且 lrbff 路由表无 tokens 接口、无法经 BFF 取。
// cn 两者同域，回落 apiBase()；global 缺配抛错，与 loginStatusTarget 同款语义。
function clawBase(): string {
  if (currentEdition() === "global") {
    return requiredGlobalEnv(
      "WXT_RENYIMIAO_CLAW_API_URL",
      import.meta.env.WXT_RENYIMIAO_CLAW_API_URL as string | undefined,
    )
  }
  return apiBase()
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
  /** 海外线唯一身份标识：Google 登录的用户没有手机号，popup 展示脱敏邮箱。cn 线该字段恒为空。 */
  email: string
  // user 形状宽松（Open Question：以真接口/参考站 MemberData 为准），本迭代原样透传内层 member。
  user: Record<string, unknown>
}

// 显式带头的 authed GET：GET + buildAuthHeaders（绝不 credentials:include）+ 401 抛错 + unwrap envelope。
// 各 fetch* 共用样板收敛于此，401 语义只此一处。
async function authedGet(
  pathname: string,
  loginCredential: string,
  clientLanguage?: string,
  base: string = apiBase(),
): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}${pathname}`, {
    method: "GET",
    headers: buildAuthHeaders(loginCredential, clientLanguage),
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
export async function fetchLoginStatus(
  loginCredential: string,
  clientLanguage?: string,
): Promise<LoginStatusResult> {
  const { base, pathname } = loginStatusTarget()
  const data = await authedGet(pathname, loginCredential, clientLanguage, base)
  // 两种响应形状：common_bll 是 { member: { mobile, nickname, accounts } } 嵌套；
  // lrbff 的 compactSession 是 { member_id, member_name, mobile, email, ... } 扁平体（无 data 封套）。
  // `data.member ?? data` 同时吃下两者。
  const member = (data.member ?? data) as Record<string, unknown>
  const phone = typeof member.mobile === "string" ? member.mobile : ""
  const email = typeof member.email === "string" ? member.email : ""
  return { phone, email, user: member }
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
export async function fetchTokens(
  loginCredential: string,
  clientLanguage?: string,
): Promise<TokensResult | null> {
  const data = await authedGet(
    "/api/claw_bff/v1/tokens",
    loginCredential,
    clientLanguage,
    clawBase(),
  )
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
  /** 当前界面语言对应的 Client-Language；缺省由 buildAuthHeaders 回落。 */
  clientLanguage?: string
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
  const { maxRetries = 3, retryDelayMs = 3000, sleep = defaultSleep, clientLanguage } = options
  // 首次立即取（开户已完成的常态一次即得）。
  const first = await fetchTokens(loginCredential, clientLanguage)
  if (first) {
    return first
  }
  // 首登开户异步 → +3s 起、每 3s、最多 maxRetries 次，任一次拿到即停。401 由 fetchTokens 直接抛出、不再重试。
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await sleep(retryDelayMs)
    const result = await fetchTokens(loginCredential, clientLanguage)
    if (result) {
      return result
    }
  }
  return null
}
