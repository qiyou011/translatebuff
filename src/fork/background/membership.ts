import type { CookieChange } from "@/fork/membership/cookie-decision"
import type { Config } from "@/types/config/config"
import { browser } from "#imports"
import { env } from "@/env"
import {
  fetchGatewayModels,
  fetchLoginStatus,
  fetchTokensWithRetry,
  MembershipUnauthorizedError,
} from "@/fork/membership/api"
import { CREDENTIAL_COOKIE_NAME, decideCookieAction } from "@/fork/membership/cookie-decision"
import { computeLoginConfigPatch, computeLogoutConfigPatch } from "@/fork/membership/key-injection"
import { clearForkSession, loadForkSession, saveForkSession } from "@/fork/membership/session"
import { onForkMessage } from "@/fork/message"
import {
  normalizeGatewayBaseUrl,
  renyimiaoApiKey,
  syncRenyimiaoModels,
} from "@/fork/providers/renyimiao"
import { configSchema } from "@/types/config/config"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { logger } from "@/utils/logger"

// 任译喵会员登录后台编排：监听官网域凭据 cookie → 接管/清态 → 取用户信息+sk_key → 写 fork 会话 + 单写 provider key。
// cookie 监听范式参考 src/entrypoints/background/proxy-fetch.ts；判定逻辑抽在 cookie-decision.ts（纯函数已测）。

// 官网 host 列表：编译期注入的静态数组，模块级算一次（cookie.onChanged 高频，避免每事件重解析 URL）。
// 用 hostname（不含端口）——cookie.domain 从不含端口（如 localhost:4173 的 cookie 域是 "localhost"）。
const OFFICIAL_HOSTS = env.WXT_OFFICIAL_SITE_ORIGINS.map((origin) => new URL(origin).hostname)

// 清态代次：每次清态自增；接管编排在终写前比对代次，作废「登录轮询中途登出被随后迟到的写覆盖」的幽灵登录。
// 与 writeConfigAtom 的 writeVersion 同款 stale-write 防护——adopt 与 clear 同在后台上下文，代次判定即有效。
let clearGeneration = 0

// 接管在途标记（按凭据去重）：主动探测、被动监听、挂载消息多路径可能对同一凭据近乎同时触发接管；
// 同凭据并发只实际跑一遍（避免冗余开户轮询 + 并发配置读改写），接管结束即释放，续期/重登可再接管。
const adoptInFlight = new Set<string>()

// 后台单写 config（设计 D5）：读一次 → 算补丁 → 合并 → 写一次。single-writer 的读-合-写只此一处。
async function applyConfigPatch(computePatch: (config: Config) => Partial<Config>): Promise<void> {
  const config = await storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
  const next = mergeWithArrayOverwrite(config, computePatch(config))
  await storageAdapter.set(CONFIG_STORAGE_KEY, next, configSchema)
}

// 端到端清态：清 fork 会话 + 清 provider key。登出移除 cookie / forkClearMembership 消息 / 接口 401 都归一到这里。
export async function clearMembership(): Promise<void> {
  clearGeneration += 1 // 作废任何在途接管的终写
  await clearForkSession()
  await applyConfigPatch(computeLogoutConfigPatch)
}

// 登录/补偿后主动拉一次网关可用模型 → 以结果重建任译喵实例集（对齐选项页「更新模型」按钮）。
// base_url 先归一到含 /v1 再拉；失败降级不阻断（syncRenyimiaoModels 空列表本就 no-op，保留静态 seed 实例）；
// 终写前比对清态代次，防登出竞态。
async function syncGatewayModels(baseUrl: string, skKey: string, gen: number): Promise<void> {
  try {
    const modelIds = await fetchGatewayModels(normalizeGatewayBaseUrl(baseUrl), skKey)
    if (gen === clearGeneration) {
      await applyConfigPatch((config) => syncRenyimiaoModels(config, modelIds))
    }
  } catch (error) {
    logger.warn("[Fork][membership] 拉网关模型失败，降级保留静态实例:", error)
  }
}

// 接管凭据编排（顺序两段，非并行）：先取用户信息立即写会话 → 再取 sk_key + base_url 单写 → 主动拉一次模型。
// 顺序化的意义：① 手机号（login_status 秒回）先写会话、登录态即时展示，不被 tokens 开户轮询（最多 ~9s）阻塞；
//   ② 天然串行避开「tokens 迟到写与登出清态交错复活 key」的并行竞态。
// 各终写前比对清态代次：期间若登出/清态则丢弃迟到结果，绝不复活已清的会话/key。
// tokens 为空（开户仍异步）→ 会话已存，key 留待 R6 挂载补偿补拉。任一接口 401 → 走清态。
export async function adoptCredential(loginCredential: string): Promise<void> {
  if (adoptInFlight.has(loginCredential)) {
    return // 同凭据接管在途，去重短路（防探测 + 监听并发双 adopt）
  }
  adoptInFlight.add(loginCredential)
  const gen = clearGeneration
  try {
    // ① 用户信息 → 立即写会话（手机号秒显，不等 tokens 轮询）。
    const { phone, user } = await fetchLoginStatus(loginCredential)
    if (gen !== clearGeneration) {
      return
    }
    await saveForkSession({ loginCredential, phone, user })
    // ② sk_key + 网关 base_url（可能走开户轮询，此时会话已展示、不阻塞登录态）。
    const tokens = await fetchTokensWithRetry(loginCredential)
    if (!tokens || gen !== clearGeneration) {
      return
    }
    await applyConfigPatch((config) =>
      computeLoginConfigPatch(config, tokens.skKey, tokens.baseUrl),
    )
    // ③ 主动拉一次模型 → 重建实例集（失败降级不阻断）。
    await syncGatewayModels(tokens.baseUrl, tokens.skKey, gen)
  } catch (error) {
    if (error instanceof MembershipUnauthorizedError) {
      await clearMembership()
      return
    }
    logger.error("[Fork][membership] adopt credential failed:", error)
  } finally {
    adoptInFlight.delete(loginCredential)
  }
}

// 冷启动/挂载主动同步：读官网域已存在的 Login-Credential cookie，无会话且 cookie 在 → 复用 adoptCredential 接管。
// 补被动 cookies.onChanged 只响应「变化事件」的缺口——装插件前已登录 / SW 冷启时 cookie 早已存在、不再变化，
// onChanged 不触发。cookie 读取 url 取 WXT_WEBSITE_URL（用户实际登录域），与 forkLogout 的 cookies.remove 对称。
// 有会话则短路（不重复接管；key 空补偿仍由 ensureMembershipKey 承担）；无 cookies.get 能力或读取异常 → 降级不阻断。
export async function syncMembershipFromWebsite(): Promise<void> {
  if (await loadForkSession()) {
    return // 已有会话，无需再接管
  }
  if (!browser.cookies?.get) {
    return
  }
  // .catch 兜底读 cookie 异常（优雅降级）；用调用式取 Promise 重载，避免 ReturnType 落到 callback 重载的 void。
  const cookie = await browser.cookies
    .get({ url: `${env.WXT_WEBSITE_URL}/`, name: CREDENTIAL_COOKIE_NAME })
    .catch(() => null)
  if (cookie?.value) {
    await adoptCredential(cookie.value)
  }
}

// R6 挂载补偿：popup/选项页挂载时若「已登录但 provider key 空」（SW 回收致轮询中断），用会话凭据重取并注入。幂等。
export async function ensureMembershipKey(): Promise<void> {
  const config = await storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
  if (renyimiaoApiKey(config.providersConfig) !== "") {
    return // key 已在，无需补
  }
  const session = await loadForkSession()
  if (!session) {
    return // 未登录，key 本就该空（对账：无会话则 key 必空）
  }
  const gen = clearGeneration
  try {
    const tokens = await fetchTokensWithRetry(session.loginCredential)
    if (tokens && gen === clearGeneration) {
      await applyConfigPatch((current) =>
        computeLoginConfigPatch(current, tokens.skKey, tokens.baseUrl),
      )
      await syncGatewayModels(tokens.baseUrl, tokens.skKey, gen)
    }
  } catch (error) {
    if (error instanceof MembershipUnauthorizedError) {
      await clearMembership()
      return
    }
    logger.error("[Fork][membership] ensure membership key failed:", error)
  }
}

// cookie watcher 接线（强浏览器依赖，最小化；判定逻辑由已测纯函数 decideCookieAction 承担）。
function registerCookieWatcher(): void {
  if (!browser.cookies?.onChanged) {
    logger.warn("[Fork][membership] browser.cookies.onChanged unavailable, skip watcher")
    return
  }
  browser.cookies.onChanged.addListener((changeInfo) => {
    const change: CookieChange = {
      removed: changeInfo.removed,
      cause: changeInfo.cause,
      cookie: { name: changeInfo.cookie.name, domain: changeInfo.cookie.domain },
    }
    const action = decideCookieAction(change, OFFICIAL_HOSTS)
    if (action === "adopt") {
      // changeInfo.cookie.value 已含 cookie 值（对齐 proxy-fetch 用法），无需再 cookies.get。
      void adoptCredential(changeInfo.cookie.value)
    } else if (action === "clear") {
      void clearMembership()
    }
  })
}

// fork 会员后台接线入口，由 setupFork() 调用。
export function setupMembership(): void {
  registerCookieWatcher()
  // 冷启即主动补读一次官网现存 cookie（先注册监听再补读，避免读与事件间漏窗）：覆盖「装前已登录 / SW 冷启 cookie 已在」。
  void syncMembershipFromWebsite()
  onForkMessage("forkEnsureMembershipKey", () => {
    void ensureMembershipKey()
  })
  // UI 挂载确定性同步：popup/选项页挂载发此消息唤醒 SW 跑一次主动探测（有会话则内部短路）。
  onForkMessage("forkSyncMembership", () => {
    void syncMembershipFromWebsite()
  })
  // 本地登出的确定性清态：即便 cookie 已不存在（remove 不触发 onChanged），也保证清 session + key。
  onForkMessage("forkClearMembership", () => {
    void clearMembership()
  })
  logger.info("[Fork][membership] setupMembership ready")
}
