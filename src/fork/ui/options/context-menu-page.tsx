import { GradientBackground } from "@/components/gradient-background"
import { PageLayout } from "@/entrypoints/options/components/page-layout"
import { ContextMenuTranslateToggle } from "@/entrypoints/options/pages/context-menu/context-menu-translate-toggle"
// 换皮：上游 options 功能页。上游用静态截图当功能示意图，截图里是 read-frog 的界面；
// fork 换成实时渲染的 CSS 插画（含品牌标），既不漏上游品牌、也不用维护三张截图。
// 除示意区外与上游逐字一致。
import { OverlayFeaturePreview } from "@/fork/ui/options/overlay-feature-preview"
import { i18n } from "@/utils/i18n"

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
