import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/base-ui/dialog"
import { isIgnoreTabAtom } from "@/entrypoints/popup/atoms/ignore"
import {
  isCurrentSiteInBlacklistAtom,
  isCurrentSiteInWhitelistAtom,
  toggleCurrentSiteInBlacklistAtom,
  toggleCurrentSiteInWhitelistAtom,
} from "@/entrypoints/popup/atoms/site-control"
import { AlwaysTranslate } from "@/entrypoints/popup/components/always-translate"
import { SiteControlToggle } from "@/entrypoints/popup/components/site-control-toggle"
import { TranslationHubButton } from "@/entrypoints/popup/components/translation-hub-button"
import { currentEdition } from "@/fork/identity/edition"
import { FeatureSettings, FEATURE_LABELS, FEATURE_ROUTES } from "@/fork/ui/feature-settings"
import { ForkAccountMenu } from "@/fork/ui/popup/account-menu"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"
import { PanelIcon } from "./panel-icon"
import { PanelModeSelector, PanelSmartSettings } from "./panel-settings"
import { QuickPanelTutorial } from "./quick-panel-tutorial"
import TranslateButton from "./translate-button"
import "./panel.css"

function App() {
  const [activeFeature, setActiveFeature] = useState<"selection" | "input" | "subtitles" | null>(
    null,
  )
  const { mode } = useAtomValue(configFieldsAtomMap.siteControl)
  const inBlacklist = useAtomValue(isCurrentSiteInBlacklistAtom)
  const inWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)
  const ignored = useAtomValue(isIgnoreTabAtom)
  const sitePaused = !ignored && (mode === "whitelist" ? !inWhitelist : inBlacklist)
  const toggleSite = useSetAtom(
    mode === "whitelist" ? toggleCurrentSiteInWhitelistAtom : toggleCurrentSiteInBlacklistAtom,
  )
  if (sitePaused && activeFeature !== null) setActiveFeature(null)
  const openSettings = () =>
    void openOptionsPage({ route: FEATURE_ROUTES[activeFeature ?? "page"] })
  return (
    <div className="tb-panel" data-site-paused={sitePaused || undefined}>
      <header className="tb-panel-header">
        <div className="tb-panel-account">
          <ForkAccountMenu />
        </div>
        <div className="tb-panel-hub">
          <TranslationHubButton />
        </div>
      </header>
      <section className="tb-page-section">
        {sitePaused ? (
          <div className="tb-site-paused" role="status">
            <PanelIcon name="paused" />
            <span>{i18n.t("quickTranslation.sitePaused")}</span>
            <button type="button" onClick={() => void toggleSite(mode === "whitelist")}>
              {i18n.t("quickTranslation.resumeSite")}
            </button>
          </div>
        ) : (
          <div className="tb-page-heading">
            <h1>{i18n.t(FEATURE_LABELS.page)}</h1>
            <PanelModeSelector />
          </div>
        )}
        <div className="tb-translation-card" inert={sitePaused}>
          <FeatureSettings feature="page" compact />
          <TranslateButton className="tb-translate-button" />
        </div>
      </section>
      <section className="tb-smart-settings" inert={sitePaused}>
        <AlwaysTranslate />
        <PanelSmartSettings />
      </section>
      <section className="tb-more-section">
        <h2>{i18n.t("quickTranslation.moreTranslations")}</h2>
        <div className="tb-feature-grid">
          {(["selection", "input", "subtitles"] as const).map((feature) => (
            <Dialog
              key={feature}
              open={!sitePaused && activeFeature === feature}
              onOpenChange={(open) => setActiveFeature(open && !sitePaused ? feature : null)}
            >
              <DialogTrigger
                disabled={sitePaused}
                render={<Button variant="outline" className="tb-feature-button" />}
              >
                <PanelIcon name={feature === "subtitles" ? "video" : feature} size={28} />
                <span>{i18n.t(FEATURE_LABELS[feature])}</span>
              </DialogTrigger>
              <DialogContent
                className="tb-quick-sheet"
                overlayClassName="tb-sheet-overlay"
                showCloseButton={false}
              >
                <div className="tb-sheet-heading">
                  <DialogTitle>
                    <PanelIcon name={feature === "subtitles" ? "video" : feature} size={24} />
                    {i18n.t(FEATURE_LABELS[feature])}
                  </DialogTitle>
                  <DialogClose className="tb-sheet-close" aria-label="Close">
                    <PanelIcon name="close" size={16} />
                  </DialogClose>
                </div>
                <FeatureSettings feature={feature} compact />
                <QuickPanelTutorial feature={feature} />
                <button type="button" className="tb-sheet-settings" onClick={openSettings}>
                  <PanelIcon name="sliders" size={14} />
                  {i18n.t("quickTranslation.allSettings")}
                </button>
              </DialogContent>
            </Dialog>
          ))}
          <Button variant="outline" className="tb-feature-button tb-coming-soon" disabled>
            <PanelIcon name="comic" size={28} />
            <span>{i18n.t("quickTranslation.comicImage")}</span>
            <small>{i18n.t("quickTranslation.comingSoon")}</small>
          </Button>
        </div>
      </section>
      <div className="tb-site-control">
        <SiteControlToggle />
      </div>
      <footer className="tb-panel-footer">
        <button type="button" onClick={openSettings}>
          <PanelIcon name="sliders" size={14} />
          {i18n.t("quickTranslation.allSettings")}
        </button>
        <span>
          {currentEdition() === "cn" ? "任译喵" : "TranslateBuff"} · {EXTENSION_VERSION}
        </span>
      </footer>
    </div>
  )
}

export default App
