import { GradientBackground } from "@/components/gradient-background"
import { i18n } from "@/utils/i18n"
import { OverlayFeaturePreview } from "../../components/overlay-feature-preview"
import { PageLayout } from "../../components/page-layout"
import { ContextMenuTranslateToggle } from "./context-menu-translate-toggle"

export function ContextMenuPage() {
  return (
    <PageLayout title={i18n.t("options.overlayTools.contextMenu.title")}>
      <GradientBackground>
        <OverlayFeaturePreview
          feature="context-menu"
          title={i18n.t("options.overlayTools.contextMenu.title")}
          description={i18n.t("options.floatingButtonAndToolbar.contextMenu.translate.description")}
        />
      </GradientBackground>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <ContextMenuTranslateToggle />
      </div>
    </PageLayout>
  )
}
