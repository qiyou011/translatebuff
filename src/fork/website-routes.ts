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
    // 海外官网把订单收在账户中心下、把反馈并进帮助页——与国内不同名。
    orders: "/account/orders",
    // 问卷两线同名，但仍两边各写一份：这张表按 edition 取值，global 缺键即取不到。
    // 海外站 2026-08-27 路由扁平化后取消了 `/extension` 前缀，两代旧前缀（`/plugin`、
    // `/extension`）改由官网 redirects 表 301 承接——那是过渡措施，本表直连新路径。
    uninstallSurvey: "/uninstall-survey",
    feedback: "/help",
  },
}

export function websiteRouteBasePath(route: WebsiteRoute): string {
  return WEBSITE_ROUTES[currentEdition()][route]
}
