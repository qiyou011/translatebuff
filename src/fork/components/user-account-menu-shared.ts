// 换皮：上游 src/components/user-account-menu/shared.tsx。
// 只改两处对外链接的解析方式（env.WXT_WEBSITE_URL 直拼 → getWebsiteUrl），其余整体复用上游。
// getWebsiteUrl 额外处理了本地预览时的 hash 路由，直拼在联调环境下会 404。
export * from "@/components/user-account-menu/shared"

import { getWebsiteUrl } from "@/fork/website-url"

export function openLogIn() {
  window.open(getWebsiteUrl("/log-in"), "_blank")
}

export function openWebApp() {
  window.open(getWebsiteUrl("/home"), "_blank")
}
