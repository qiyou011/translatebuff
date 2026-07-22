import { IconLogout, IconSelector, IconUserCircle } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/base-ui/sidebar"
import { forkLogout, useForkSession, useOpenForkLogin } from "@/fork/membership/atoms"
import { maskPhone } from "@/fork/membership/phone-mask"
import { i18n } from "@/utils/i18n"

// fork 选项页侧边栏账户菜单：由 app-sidebar/index.tsx 直接 import 本文件顶替上游 better-auth 版侧边栏。
// 硬约束：侧边栏账户菜单必须直连本文件，禁止再从 @/components/user-account-menu barrel 取
// UserAccountMenuSidebar —— 那条仍导出上游 better-auth 版（读独立 session、恒显「登录」），会静默回退。
// 换皮不换壳——沿用上游 SidebarMenu 视觉容器，逻辑改用 fork 会话（复用 popup ForkAccountMenu 同一套 atoms）。
// 不引用上游 shared.tsx（那是 better-auth 的 useSession/logout）。侧边栏常驻，由它持有 useForkSession 水合会话。
// 未登录 → 登录入口（跳官网）；已登录 → 脱敏手机号 + 登出（删官网 cookie 触发后台完整清态）。
export function UserAccountMenuSidebar() {
  const session = useForkSession()
  const openLogin = useOpenForkLogin()

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

  const maskedPhone = maskPhone(session.phone)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={maskedPhone}
                className="cursor-pointer data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            <IconUserCircle className="size-6 shrink-0 text-foreground" aria-hidden />
            <span className="flex-1 truncate text-left text-sm font-medium tabular-nums">
              {maskedPhone}
            </span>
            <IconSelector aria-hidden className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="min-w-56">
            <div className="px-1.5 py-1.5 text-xs text-muted-foreground tabular-nums">
              {maskedPhone}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void forkLogout()}
              className="cursor-pointer transition-colors"
            >
              <IconLogout aria-hidden />
              {i18n.t("account.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
