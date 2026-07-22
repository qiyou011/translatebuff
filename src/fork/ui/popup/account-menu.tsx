import { IconLogout, IconUserCircle } from "@tabler/icons-react"
import { Button } from "@/components/ui/base-ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { forkLogout, useForkSession, useOpenForkLogin } from "@/fork/membership/atoms"
import { maskPhone } from "@/fork/membership/phone-mask"
import { i18n } from "@/utils/i18n"

// fork 自有账户菜单：替换上游 better-auth 的 UserAccountMenuPopup（换皮，不并列两套登录语义）。
// 复用上游逻辑基座（会话 hook + base-ui 原语），不引用上游 composed UI 组件。
// 未登录 → 登录入口（跳官网）；已登录 → 手机号 + 登出（删官网 cookie 触发后台完整清态）。
export function ForkAccountMenu() {
  const session = useForkSession()
  const openLogin = useOpenForkLogin()

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <IconUserCircle className="size-6 text-muted-foreground" aria-hidden />
        <Button size="xs" variant="outline" onClick={openLogin}>
          {i18n.t("account.login")}
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="group/account flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-accent/70 data-[popup-open]:bg-accent"
          />
        }
      >
        <IconUserCircle className="size-6 text-foreground" aria-hidden />
        <span className="truncate text-sm font-medium tabular-nums">
          {maskPhone(session.phone)}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="min-w-48">
        <div className="px-1.5 py-1.5 text-xs text-muted-foreground tabular-nums">
          {maskPhone(session.phone)}
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
  )
}
