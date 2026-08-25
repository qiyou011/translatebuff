import { Icon } from "@iconify/react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/base-ui/sidebar"
import { FORK_PRODUCT_LINKS } from "@/fork/ui/options/product-links"
import { i18n } from "@/utils/i18n"

// 换皮：上游 options/app-sidebar/product-nav.tsx。
// 上游那版按 Featurebase 门户拼「路线图 + 反馈」两条链接，且随 UI 语言切 locale；
// fork 只留反馈、写死自家地址，故不再需要 uiLanguage 与 locale 解析。
export function ProductNav() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.product")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {FORK_PRODUCT_LINKS.map(({ href, icon, labelKey }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                render={<a href={href} target="_blank" rel="noopener noreferrer" />}
              >
                <Icon icon={icon} />
                <span>{i18n.t(labelKey)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
