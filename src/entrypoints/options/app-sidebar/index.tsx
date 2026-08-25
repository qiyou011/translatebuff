import { IconSearch } from "@tabler/icons-react"
import { useSetAtom } from "jotai"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/base-ui/input-group"
import { Kbd } from "@/components/ui/base-ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/base-ui/sidebar"
import { BrandMark } from "@/fork/components/brand-mark"
import { UserAccountMenuSidebar } from "@/fork/ui/options/account-menu-sidebar"
import { i18n } from "@/utils/i18n"
import { getCommandPaletteShortcutHint } from "@/utils/os"
import { commandPaletteOpenAtom } from "../command-palette/atoms"
import { ProductNav } from "./product-nav"
import { SettingsNav } from "./settings-nav"
import { ToolsNav } from "./tools-nav"
import { WhatsNewFooter } from "./whats-new-footer"

export function AppSidebar() {
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom)
  const commandPaletteShortcutHint = getCommandPaletteShortcutHint()

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="transition-[padding] duration-200 group-data-[state=expanded]:px-4 group-data-[state=expanded]:pt-4">
        <BrandMark
          className="h-10 px-2 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0"
          iconClassName="size-7"
          nameClassName="text-[15px] tracking-tight group-data-[state=collapsed]:hidden"
        />
        <UserAccountMenuSidebar />
        <InputGroup
          onClick={() => setCommandPaletteOpen(true)}
          className="shadow-control border-0 bg-card text-sidebar-foreground transition-colors duration-200 hover:bg-muted"
        >
          <InputGroupInput
            readOnly
            placeholder={i18n.t("options.commandPalette.placeholder")}
            className="cursor-pointer"
          />
          <InputGroupAddon>
            <IconSearch className="size-4 text-muted-foreground group-data-[state=collapsed]:-mx-px" />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end" className="group-data-[state=collapsed]:hidden">
            <Kbd>{commandPaletteShortcutHint}</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </SidebarHeader>
      <SidebarContent className="transition-[padding] duration-200 group-data-[state=expanded]:px-2">
        <SettingsNav />
        <ToolsNav />
        <ProductNav />
      </SidebarContent>
      <SidebarFooter className="transition-[padding] duration-200 group-data-[state=expanded]:px-2">
        <WhatsNewFooter />
      </SidebarFooter>
    </Sidebar>
  )
}
