import "@/utils/zod-config"
import type { Config } from "@/types/config/config"
import type { ThemeMode } from "@/types/config/theme"
import { QueryClientProvider } from "@tanstack/react-query"
import { Provider as JotaiProvider, useSetAtom } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import * as React from "react"
import { browser } from "#imports"
import BrandToast from "@/components/brand-toast"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { RecoveryBoundary } from "@/components/recovery/recovery-boundary"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { baseThemeModeAtom } from "@/utils/atoms/theme"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { initI18n } from "@/utils/i18n"
import { LocaleBoundary } from "@/utils/i18n/locale-boundary"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { renderPersistentReactRoot } from "@/utils/react-root"
import { queryClient } from "@/utils/tanstack-query"
import { getLocalThemeMode } from "@/utils/theme"
import App from "./app"
import {
  isUrlInPatterns,
  isCurrentSiteInPatternsAtom,
  isPageTranslatedAtom,
} from "./atoms/auto-translate"
import { isIgnoreTabAtom, isIgnoreUrl } from "./atoms/ignore"
import {
  isCurrentSiteInBlacklistAtom,
  isCurrentSiteInWhitelistAtom,
  isInSiteControlList,
} from "./atoms/site-control"
import "@fontsource-variable/onest/index.css"
import "@/assets/styles/text-small.css"
import "@/assets/styles/theme.css"

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: [
    [typeof configAtom, Config],
    [typeof isPageTranslatedAtom, boolean],
    [typeof isCurrentSiteInPatternsAtom, boolean],
    [typeof isIgnoreTabAtom, boolean],
    [typeof isCurrentSiteInWhitelistAtom, boolean],
    [typeof isCurrentSiteInBlacklistAtom, boolean],
    [typeof baseThemeModeAtom, ThemeMode],
  ]
  children: React.ReactNode
}) {
  useHydrateAtoms(initialValues)
  return children
}

function PopupRuntimeSync({ tabId }: { tabId?: number }) {
  const setIsPageTranslated = useSetAtom(isPageTranslatedAtom)

  React.useEffect(() => {
    if (!tabId) return () => {}

    let isActive = true
    void sendMessage("getEnablePageTranslationByTabId", { tabId })
      .then((value) => {
        if (isActive) {
          setIsPageTranslated(value ?? false)
        }
      })
      .catch((error) => {
        logger.warn("Failed to load popup translation state", error)
      })

    return () => {
      isActive = false
    }
  }, [setIsPageTranslated, tabId])

  return null
}

async function initApp() {
  const root = document.getElementById("root")!
  root.className = "text-[15px] antialiased w-[392px] bg-background"

  const [configValue, themeMode, activeTab] = await Promise.all([
    getLocalConfig(),
    getLocalThemeMode(),
    browser.tabs.query({
      active: true,
      currentWindow: true,
    }),
  ])
  const config = configValue ?? DEFAULT_CONFIG

  await initI18n(config.uiLanguage)

  const currentTab = activeTab[0]
  const tabId = currentTab?.id
  const activeTabUrl = currentTab?.url || ""
  const isInPatterns = activeTabUrl ? isUrlInPatterns(config.translate, activeTabUrl) : false
  const isIgnoreTab = isIgnoreUrl(activeTabUrl)
  const isInWhitelist = activeTabUrl
    ? isInSiteControlList(config.siteControl.whitelistPatterns, activeTabUrl)
    : false
  const isInBlacklist = activeTabUrl
    ? isInSiteControlList(config.siteControl.blacklistPatterns, activeTabUrl)
    : false

  renderPersistentReactRoot(
    root,
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <HydrateAtoms
            initialValues={[
              [configAtom, config],
              [isPageTranslatedAtom, false],
              [isCurrentSiteInPatternsAtom, isInPatterns],
              [isIgnoreTabAtom, isIgnoreTab],
              [isCurrentSiteInWhitelistAtom, isInWhitelist],
              [isCurrentSiteInBlacklistAtom, isInBlacklist],
              [baseThemeModeAtom, themeMode],
            ]}
          >
            <PopupRuntimeSync tabId={tabId} />
            <ThemeProvider>
              <TooltipProvider>
                <BrandToast />
                <LocaleBoundary>
                  <RecoveryBoundary>
                    <App />
                  </RecoveryBoundary>
                </LocaleBoundary>
              </TooltipProvider>
            </ThemeProvider>
          </HydrateAtoms>
        </JotaiProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

void initApp().catch((error) => {
  logger.error("Failed to initialize popup", error)

  const root = document.getElementById("root")
  if (!root) return

  root.className =
    "flex min-h-48 w-[392px] flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground"
  root.replaceChildren()

  const message = document.createElement("p")
  message.className = "text-sm text-muted-foreground"
  message.textContent = "插件加载失败，请重试"

  const retryButton = document.createElement("button")
  retryButton.type = "button"
  retryButton.className =
    "h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
  retryButton.textContent = "重新加载"
  retryButton.addEventListener("click", () => window.location.reload())

  root.append(message, retryButton)
})
