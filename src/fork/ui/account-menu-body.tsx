import type { MembershipInfo } from "@/fork/membership/tier"
import { IconLogout, IconReceipt } from "@tabler/icons-react"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/base-ui/dropdown-menu"
import { forkLogout } from "@/fork/membership/atoms"
import { formatCredits } from "@/fork/membership/tier"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

// fork 账户菜单会员徽章：入口 trigger 展示会员身份（免费/PRO），参考官网头像标签。
// tier 缺失（会员信息未拉到）时不渲染。popup 与侧边栏两壳 trigger 共用。
export function TierBadge({ tier }: { tier: MembershipInfo["tier"] | undefined }) {
  if (!tier) {
    return null
  }
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center rounded-full px-1.5 text-[10px] leading-none font-black",
        tier === "pro" ? "bg-foreground text-background" : "bg-muted text-foreground",
      )}
    >
      {tier === "pro" ? i18n.t("forkMembership.tierPro") : i18n.t("forkMembership.tierFree")}
    </span>
  )
}

// fork 账户菜单二级菜单公共内容体：PRO 会员信息（本月剩余用量 + 会员到期，两行）+ 我的订单 + 登出。
// 手机号与会员徽章已在入口 trigger 展示，此处不重复。popup 与选项页侧边栏两壳共用。
export function ForkAccountMenuBody({
  membershipInfo,
  onOpenOrders,
}: {
  membershipInfo: MembershipInfo | null
  onOpenOrders: () => void
}) {
  return (
    <>
      {membershipInfo?.tier === "pro" && (
        <>
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground tabular-nums">
            <div>
              {i18n.t("forkMembership.remainingTokens", [
                formatCredits(membershipInfo.remainQuota),
              ])}
            </div>
            {membershipInfo.expiryDate && (
              <div>
                {i18n.t("forkMembership.expiry")} {membershipInfo.expiryDate}
              </div>
            )}
          </div>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem onClick={onOpenOrders} className="cursor-pointer transition-colors">
        <IconReceipt aria-hidden />
        {i18n.t("forkMembership.myOrder")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => void forkLogout()}
        className="cursor-pointer transition-colors"
      >
        <IconLogout aria-hidden />
        {i18n.t("account.logout")}
      </DropdownMenuItem>
    </>
  )
}
