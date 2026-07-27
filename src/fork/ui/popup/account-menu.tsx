import { IconUserCircle } from "@tabler/icons-react"
import { Button } from "@/components/ui/base-ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { useForkSession, useOpenForkLogin, useOpenForkOrders } from "@/fork/membership/atoms"
import { useForkMembershipInfo } from "@/fork/membership/membership-info"
import { maskPhone } from "@/fork/membership/phone-mask"
import { ForkAccountMenuBody, TierBadge } from "@/fork/ui/account-menu-body"
import { i18n } from "@/utils/i18n"

// fork 自有账户菜单：替换上游 better-auth 的 UserAccountMenuPopup（换皮，不并列两套登录语义）。
// 复用上游逻辑基座（会话 hook + base-ui 原语），不引用上游 composed UI 组件。
// 未登录 → 登录入口；已登录 → 入口 trigger 显手机号 + 会员徽章，二级菜单显会员信息 + 我的订单 + 登出。
export function ForkAccountMenu() {
  const session = useForkSession()
  const membershipInfo = useForkMembershipInfo()
  const openLogin = useOpenForkLogin()
  const openOrders = useOpenForkOrders()

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

  const maskedPhone = maskPhone(session.phone)

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
        <span className="truncate text-sm font-medium tabular-nums">{maskedPhone}</span>
        <TierBadge tier={membershipInfo?.tier} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="min-w-48">
        <ForkAccountMenuBody membershipInfo={membershipInfo} onOpenOrders={openOrders} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
