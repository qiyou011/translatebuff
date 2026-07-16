import "@/utils/zod-config"
import type { ThemeMode } from "@/types/config/theme"
import { Provider as JotaiProvider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { BrandMark } from "@/components/brand-mark"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { baseThemeModeAtom } from "@/utils/atoms/theme"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { i18n, initI18n } from "@/utils/i18n"
import { renderPersistentReactRoot } from "@/utils/react-root"
import { getLocalThemeMode } from "@/utils/theme"
import "@fontsource-variable/onest/index.css"
import "@/assets/styles/text-small.css"
import "@/assets/styles/theme.css"

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: [[typeof baseThemeModeAtom, ThemeMode]]
  children: React.ReactNode
}) {
  useHydrateAtoms(initialValues)
  return children
}

function SidePanelShell() {
  return (
    <main className="flex min-h-screen flex-col bg-background px-5 py-6 text-foreground">
      <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <BrandMark
          className="flex-col gap-3"
          iconClassName="size-16 rounded-xl"
          nameClassName="text-xl tracking-tight"
        />
        <p className="max-w-64 text-sm leading-6 text-pretty text-muted-foreground">
          {i18n.t("extDescription")}
        </p>
      </section>
    </main>
  )
}

async function initApp() {
  const root = document.getElementById("root")!
  root.className = "min-h-screen bg-background text-base antialiased"

  const [configValue, themeMode] = await Promise.all([getLocalConfig(), getLocalThemeMode()])
  await initI18n((configValue ?? DEFAULT_CONFIG).uiLanguage)

  renderPersistentReactRoot(
    root,
    <JotaiProvider>
      <HydrateAtoms initialValues={[[baseThemeModeAtom, themeMode]]}>
        <ThemeProvider>
          <SidePanelShell />
        </ThemeProvider>
      </HydrateAtoms>
    </JotaiProvider>,
  )
}

void initApp()
