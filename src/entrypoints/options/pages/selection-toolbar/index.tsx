import { GradientBackground } from "@/components/gradient-background"
import { i18n } from "@/utils/i18n"
import { OverlayFeaturePreview } from "../../components/overlay-feature-preview"
import { PageLayout } from "../../components/page-layout"
import { SelectionToolbarDisabledSites } from "./selection-toolbar-disabled-sites"
import { SelectionToolbarFeatureToggles } from "./selection-toolbar-feature-toggles"
import { SelectionToolbarGlobalToggle } from "./selection-toolbar-global-toggle"
import { SelectionToolbarOpacity } from "./selection-toolbar-opacity"
import { SelectionTranslationShortcut } from "./selection-translation-shortcut"

export function SelectionToolbarPage() {
  return (
    <PageLayout title={i18n.t("options.overlayTools.selectionToolbar.title")}>
      <GradientBackground>
        <OverlayFeaturePreview
          feature="selection-toolbar"
          title={i18n.t("options.overlayTools.selectionToolbar.title")}
          description={i18n.t(
            "options.floatingButtonAndToolbar.selectionToolbar.globalToggle.description",
          )}
        />
      </GradientBackground>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <SelectionToolbarGlobalToggle />
        <SelectionToolbarOpacity />
        <SelectionToolbarFeatureToggles />
        <SelectionTranslationShortcut />
        <SelectionToolbarDisabledSites />
      </div>
    </PageLayout>
  )
}
