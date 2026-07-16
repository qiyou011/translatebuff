import { GradientBackground } from "@/components/gradient-background"
import { i18n } from "@/utils/i18n"
import { OverlayFeaturePreview } from "../../components/overlay-feature-preview"
import { PageLayout } from "../../components/page-layout"
import { FloatingButtonClickAction } from "./floating-button-click-action"
import { FloatingButtonDisabledSites } from "./floating-button-disabled-sites"
import { FloatingButtonGlobalToggle } from "./floating-button-global-toggle"
import { FloatingButtonSide } from "./floating-button-side"

export function FloatingButtonPage() {
  return (
    <PageLayout title={i18n.t("options.overlayTools.floatingButton.title")}>
      <GradientBackground>
        <OverlayFeaturePreview
          feature="floating-button"
          title={i18n.t("options.overlayTools.floatingButton.title")}
          description={i18n.t(
            "options.floatingButtonAndToolbar.floatingButton.globalToggle.description",
          )}
        />
      </GradientBackground>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <FloatingButtonGlobalToggle />
        <FloatingButtonSide />
        <FloatingButtonClickAction />
        <FloatingButtonDisabledSites />
      </div>
    </PageLayout>
  )
}
