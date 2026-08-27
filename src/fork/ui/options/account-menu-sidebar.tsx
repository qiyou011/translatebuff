import { IconSelector, IconUserCircle } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/base-ui/sidebar"
import { accountLabel } from "@/fork/membership/account-label"
import { useForkSession, useOpenForkLogin, useOpenForkOrders } from "@/fork/membership/atoms"
import { useForkMembershipInfo } from "@/fork/membership/membership-info"
import { ForkAccountMenuBody, TierBadge } from "@/fork/ui/account-menu-body"
import { i18n } from "@/utils/i18n"

// fork 选项页侧边栏账户菜单：由 app-sidebar/index.tsx 直接 import 本文件顶替上游 better-auth 版侧边栏。
// 硬约束：侧边栏账户菜单必须直连本文件，禁止再从 @/components/user-account-menu barrel 取
// UserAccountMenuSidebar —— 那条仍导出上游 better-auth 版（读独立 session、恒显「登录」），会静默回退。
// 换皮不换壳——沿用上游 SidebarMenu 视觉容器，逻辑改用 fork 会话（复用 popup ForkAccountMenu 同一套 atoms）。
// 未登录 → 登录入口；已登录 → 入口 trigger 显手机号 + 会员徽章，二级菜单显会员信息 + 我的订单 + 登出。
export function UserAccountMenuSidebar() {
  const session = useForkSession()
  const membershipInfo = useForkMembershipInfo()
  const openLogin = useOpenForkLogin()
  const openOrders = useOpenForkOrders()

  if (!session) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            tooltip={i18n.t("account.login")}
            onClick={openLogin}
            className="cursor-pointer"
          >
            <IconUserCircle className="size-6 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate font-medium">{i18n.t("account.login")}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const label = accountLabel(session)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={label.text}
                className="cursor-pointer data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            <IconUserCircle className="size-6 shrink-0 text-foreground" aria-hidden />
            <span
              className={`flex-1 truncate text-left text-sm font-medium${label.tabularNums ? " tabular-nums" : ""}`}
            >
              {label.text}
            </span>
            <TierBadge tier={membershipInfo?.tier} />
            <IconSelector aria-hidden className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="min-w-56">
            <ForkAccountMenuBody membershipInfo={membershipInfo} onOpenOrders={openOrders} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
