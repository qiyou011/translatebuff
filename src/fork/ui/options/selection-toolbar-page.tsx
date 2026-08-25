import { GradientBackground } from "@/components/gradient-background"
import { PageLayout } from "@/entrypoints/options/components/page-layout"
import { SelectionToolbarDisabledSites } from "@/entrypoints/options/pages/selection-toolbar/selection-toolbar-disabled-sites"
import { SelectionToolbarFeatureToggles } from "@/entrypoints/options/pages/selection-toolbar/selection-toolbar-feature-toggles"
import { SelectionToolbarGlobalToggle } from "@/entrypoints/options/pages/selection-toolbar/selection-toolbar-global-toggle"
import { SelectionToolbarOpacity } from "@/entrypoints/options/pages/selection-toolbar/selection-toolbar-opacity"
import { SelectionToolbarSaveSuggestionToggle } from "@/entrypoints/options/pages/selection-toolbar/selection-toolbar-save-suggestion-toggle"
import { SelectionTranslationShortcut } from "@/entrypoints/options/pages/selection-toolbar/selection-translation-shortcut"
// 换皮：上游 options 功能页。上游用静态截图当功能示意图，截图里是 read-frog 的界面；
// fork 换成实时渲染的 CSS 插画（含品牌标），既不漏上游品牌、也不用维护三张截图。
// 除示意区外与上游逐字一致。
import { OverlayFeaturePreview } from "@/fork/ui/options/overlay-feature-preview"
import { i18n } from "@/utils/i18n"

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
        <SelectionToolbarSaveSuggestionToggle />
        <SelectionTranslationShortcut />
        <SelectionToolbarDisabledSites />
      </div>
    </PageLayout>
  )
}
