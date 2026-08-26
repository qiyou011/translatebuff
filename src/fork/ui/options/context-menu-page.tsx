import { GradientBackground } from "@/components/gradient-background"
import { PageLayout } from "@/entrypoints/options/components/page-layout"
import { EnableItem } from "@/entrypoints/options/pages/context-menu/enable-item"
// 换皮：上游 options 功能页。上游用静态截图当功能示意图，图里是 read-frog 的界面；
// fork 换成实时渲染的 CSS 插画（含品牌标），既不漏上游品牌、也不用维护三张截图。
// 除示意区外与上游逐字一致——上游 v1.46.4 重构过本页，本副本已按新结构重新生成。
import { OverlayFeaturePreview } from "@/fork/ui/options/overlay-feature-preview"
import { i18n } from "@/utils/i18n"

export function ContextMenuPage() {
  return (
    <PageLayout
      title={i18n.t("options.contextMenu.title")}
      description={i18n.t("options.contextMenu.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <GradientBackground>
        <OverlayFeaturePreview
          feature="context-menu"
          title={i18n.t("options.contextMenu.title")}
          description={i18n.t("options.contextMenu.pageDescription")}
        />
      </GradientBackground>
      <EnableItem />
    </PageLayout>
  )
}
