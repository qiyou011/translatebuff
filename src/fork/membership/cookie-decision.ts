// cookie watcher 的纯判定逻辑：官网域写入凭据→接管，续期→忽略，登出移除→清态。
// 抽成纯函数便于单测；接线在 src/fork/background 里消费 browser.cookies.onChanged 事件。

export const CREDENTIAL_COOKIE_NAME = "Login-Credential"

export interface CookieChange {
  removed: boolean
  cause?: string
  cookie: { name: string; domain: string }
}

export type CookieAction = "adopt" | "clear" | "ignore"

// cookie.domain 命中官网 host：精确相等、带前导点、或其子域。
function domainMatchesHost(domain: string, host: string): boolean {
  const normalized = domain.replace(/^\./, "")
  return normalized === host || normalized.endsWith(`.${host}`)
}

export function decideCookieAction(change: CookieChange, officialHosts: string[]): CookieAction {
  // name 必须精确等值，避免 includes 子串误触（如 better-auth.session_token / Login-Credential-Extra）。
  if (change.cookie.name !== CREDENTIAL_COOKIE_NAME) {
    return "ignore"
  }
  if (!officialHosts.some((host) => domainMatchesHost(change.cookie.domain, host))) {
    return "ignore"
  }
  // set（写入/续期后的最终态）→ 接管。
  if (!change.removed) {
    return "adopt"
  }
  // 续期会先触发 removed+overwrite，绝不误判为登出。
  if (change.cause === "overwrite") {
    return "ignore"
  }
  // 真正的移除（explicit / expired 等）→ 登出清态。
  return "clear"
}
