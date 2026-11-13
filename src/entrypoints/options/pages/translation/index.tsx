import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { CacheSection } from "./cache"
import { HoverTranslationSection } from "./hover-translation"
import { PersonalizedPromptsSection } from "./personalized-prompts"
import { PreferenceSection } from "./preference"
import { TranslationControlSection } from "./translation-control"
import { TranslationQueueSection } from "./translation-queue"
import { TranslationStyleSection } from "./translation-style"

export function TranslationPage() {
  return (
    <PageLayout
      title={i18n.t("options.translation.title")}
      innerClassName="translation-page flex flex-col gap-10"
    >
      <TranslationStyleSection />
      <PersonalizedPromptsSection />
      <PreferenceSection />
      <HoverTranslationSection />
      <h2 className="translation-controls-heading">
        {i18n.t("options.translation.controlsAndRequests")}
      </h2>
      <TranslationControlSection />
      <TranslationQueueSection />
      <CacheSection />
    </PageLayout>
  )
}
