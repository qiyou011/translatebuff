import { Icon } from "@iconify/react"
import { Link, useLocation } from "react-router"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"

// 换皮：上游 options/app-sidebar/product-nav.tsx。
// 上游「产品」组是「路线图 + 帮助与社区」两条：路线图指向它自家的 Featurebase 门户，
// 任译喵没有路线图页，故整条隐藏；帮助与社区保留（页内的反馈地址已由
// src/fork/ui/options/featurebase.ts 换皮到 translatebuff.cn/feedback）。
// 上游那版还要按 UI 语言解析门户 locale，fork 去掉路线图后不再需要，一并省去。
export function ProductNav() {
  const { pathname } = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.product")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/help-and-community" />}
              isActive={pathname === "/help-and-community"}
              tooltip={i18n.t("options.helpAndCommunity.title")}
            >
              <Icon icon="tabler:message-circle" />
              <span>{i18n.t("options.helpAndCommunity.title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
