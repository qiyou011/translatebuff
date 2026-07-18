import type { CookieChange } from "@/fork/membership/cookie-decision"
import type { Config } from "@/types/config/config"
import { browser } from "#imports"
import { env } from "@/env"
import {
  fetchLoginStatus,
  fetchTokensWithRetry,
  MembershipUnauthorizedError,
} from "@/fork/membership/api"
import { decideCookieAction } from "@/fork/membership/cookie-decision"
import { computeLoginConfigPatch, computeLogoutConfigPatch } from "@/fork/membership/key-injection"
import { clearForkSession, loadForkSession, saveForkSession } from "@/fork/membership/session"
import { onForkMessage } from "@/fork/message"
import { renyimiaoApiKey } from "@/fork/providers/renyimiao"
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

// 接管凭据编排：并行取用户信息 + sk_key → 存会话 + 单写 key。
// 终写前比对清态代次：期间若发生登出/清态则丢弃迟到结果，绝不复活已清的会话/key。
// tokens 为空（开户仍异步）→ 会话已存，key 留待 R6 挂载补偿补拉。任一接口 401 → 走清态。
export async function adoptCredential(loginCredential: string): Promise<void> {
  const gen = clearGeneration
  try {
    const [{ phone, user }, tokens] = await Promise.all([
      fetchLoginStatus(loginCredential),
      fetchTokensWithRetry(loginCredential),
    ])
    if (gen !== clearGeneration) {
      return // 期间已清态（如登录轮询中途登出），丢弃迟到结果
    }
    await saveForkSession({ loginCredential, phone, user })
    if (tokens) {
      await applyConfigPatch((config) => computeLoginConfigPatch(config, tokens.skKey))
    }
  } catch (error) {
    if (error instanceof MembershipUnauthorizedError) {
      await clearMembership()
      return
    }
    logger.error("[Fork][membership] adopt credential failed:", error)
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
      await applyConfigPatch((current) => computeLoginConfigPatch(current, tokens.skKey))
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
  onForkMessage("forkEnsureMembershipKey", () => {
    void ensureMembershipKey()
  })
  // 本地登出的确定性清态：即便 cookie 已不存在（remove 不触发 onChanged），也保证清 session + key。
  onForkMessage("forkClearMembership", () => {
    void clearMembership()
  })
  logger.info("[Fork][membership] setupMembership ready")
}
