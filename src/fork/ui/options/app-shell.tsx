import type { ReactNode } from "react"
import { useLayoutEffect } from "react"
import { AppShell as UpstreamAppShell } from "@/entrypoints/options/app-shell"
import "@fontsource-variable/onest/index.css"
import "./options-theme.css"

export const OPTIONS_THEME_ATTRIBUTE = "data-translatebuff-options-theme"

export function AppShell({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute(OPTIONS_THEME_ATTRIBUTE, "")
    return () => document.documentElement.removeAttribute(OPTIONS_THEME_ATTRIBUTE)
  }, [])

  return <UpstreamAppShell>{children}</UpstreamAppShell>
}
