import type { ForkSession } from "./session"
import { atom, useAtom, useAtomValue } from "jotai"
import { useCallback, useEffect, useRef } from "react"
import { browser, storage } from "#imports"
import { env } from "@/env"
import { sendForkMessage } from "@/fork/message"
import { renyimiaoApiKey } from "@/fork/providers/renyimiao"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { resolveUiLocale } from "@/utils/i18n/locale-map"
import { CREDENTIAL_COOKIE_NAME } from "./cookie-decision"
import { clearForkSession, FORK_SESSION_STORAGE_KEY, loadForkSession } from "./session"
import { websiteLoginPath } from "./website-locale"

// 任译喵会员会话的响应式载体：popup / 选项页共享同一份登录态。
// 初值 null（未登录）；由 useForkSession 挂载时水合 + 订阅 storage 变化写入。
export const forkSessionAtom = atom<ForkSession | null>(null)

// 响应式会话 hook：挂载时 loadForkSession() 水合，并 storage.watch 订阅后台写入的登录/登出变化。
// 附带 R6 挂载补偿：已登录但 provider key 空（SW 中途被回收致注入丢失）→ 请后台重取 sk_key（幂等）。
export function useForkSession(): ForkSession | null {
  const [session, setSession] = useAtom(forkSessionAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  // 记录已补偿过的凭据，避免同一登录态因 config 变更被反复触发。
  const nudgedCredential = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    // 水合 + watch 复用同一读取路径（loadForkSession 内含 schema 校验，失效即视为未登录）。
    const hydrate = () => {
      void loadForkSession().then((loaded) => {
        if (active) {
          setSession(loaded)
        }
      })
    }
    hydrate()
    const unwatch = storage.watch(`local:${FORK_SESSION_STORAGE_KEY}`, hydrate)
    return () => {
      active = false
      unwatch()
    }
  }, [setSession])

  useEffect(() => {
    if (!session) {
      nudgedCredential.current = null
      return
    }
    if (
      renyimiaoApiKey(providersConfig) === "" &&
      nudgedCredential.current !== session.loginCredential
    ) {
      nudgedCredential.current = session.loginCredential
      void sendForkMessage("forkEnsureMembershipKey")
    }
  }, [session, providersConfig])

  return session
}

// 登出：① 删官网域 Login-Credential cookie（防 watcher 再次接管）；② 请后台确定性清态（session + key）；
// ③ 乐观本地清 session 让 UI 即时反映登出。用显式消息而非仅靠 cookie.remove 触发 watcher——cookie 已不存在时
// remove 是 no-op、不触发 onChanged，若只靠事件会漏清 provider key（滞留幽灵 key）。key 物理清空仍由后台单写者做。
export async function forkLogout(): Promise<void> {
  try {
    await browser.cookies.remove({
      url: `${env.WXT_WEBSITE_URL}/`,
      name: CREDENTIAL_COOKIE_NAME,
    })
  } catch {
    // 忽略：cookie 可能已不存在
  }
  void sendForkMessage("forkClearMembership")
  await clearForkSession()
}

// 打开官网登录页（按当前界面语言映射多语言路径），新开标签页。
// uiLanguage 可能为 "auto"，先 resolveUiLocale 归一到具体 locale，再拼 next-intl 路径。
// 直接拼干净 path（官网 translatebuff-web 是 Next.js 路径路由，如 http://localhost:3000/login）——
// 不用 getWebsiteUrl：它对 localhost 走 hash 路由（`#/path`，read-frog guide 本地预览用），会把 /login 变成 #/login 到不了页面。
export function useOpenForkLogin(): () => void {
  const uiLanguage = useAtomValue(configFieldsAtomMap.uiLanguage)
  return useCallback(() => {
    const locale = resolveUiLocale(uiLanguage)
    void browser.tabs.create({ url: `${env.WXT_WEBSITE_URL}${websiteLoginPath(locale)}` })
  }, [uiLanguage])
}
