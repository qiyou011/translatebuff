// 插件对外跳转的官网基础路径，按 edition 取值——两条官网的路由结构不同，换域名不够、路径也得换。
// 单一真源：各调用点（登录/订单跳转、卸载问卷、反馈入口）只取键，不拼字面量。
//
// 多语言前缀不在这里拼：由 membership/website-locale.ts 的 websiteLocalePath(locale, path) 包在外层，
// 前缀恒在最前（/zh-hans/account/orders，而非 /account/zh-hans/orders）。

import type { ForkEdition } from "@/fork/identity/edition"
import { currentEdition } from "@/fork/identity/edition"

export type WebsiteRoute = "login" | "orders" | "uninstallSurvey" | "feedback"

// 两条线各一张表；键集合必须一致（有单测锁定，漏配一条即失败）。
export const WEBSITE_ROUTES: Record<ForkEdition, Record<WebsiteRoute, string>> = {
  cn: {
    login: "/login",
    orders: "/orders",
    uninstallSurvey: "/uninstall-survey",
    feedback: "/feedback",
  },
  global: {
    login: "/login",
    // 海外官网把订单收在账户中心下、把插件相关页收在产品页下、把反馈并进帮助页——与国内不同名。
    orders: "/account/orders",
    // ⚠️ 发版前必须确认海外官网已部署 `/plugin` → `/extension` 改名：该改名在官网仓已合并、
    // 但 2026-08-26 实测线上仍是 `/plugin` 时代，此路径当时返回 404（裸 `/uninstall-survey`
    // 反而能通——官网 redirects 表为已发布插件的裸路径留了承接）。产品确认直连新路径、
    // 接受部署前是死链（MUL-67）。官网部署后本行即生效，无需改代码。
    uninstallSurvey: "/extension/uninstall-survey",
    feedback: "/help",
  },
}

export function websiteRouteBasePath(route: WebsiteRoute): string {
  return WEBSITE_ROUTES[currentEdition()][route]
}
