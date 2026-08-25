import { BrandMark } from "@/fork/components/brand-mark"
import { i18n } from "@/utils/i18n"
import { LanguageControlPanel } from "./components/language-control-panel"
import { PromptSelector } from "./components/prompt-selector"
import { TextInput } from "./components/text-input"
import { TranslationPanel } from "./components/translation-panel"
import { TranslationPanelActions } from "./components/translation-panel-actions"
import { TranslationServiceDropdown } from "./components/translation-service-dropdown"

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl min-w-0 items-center gap-3 px-5 md:px-8">
          <BrandMark nameClassName="text-sm" />
          <span className="h-5 w-px bg-border" aria-hidden="true" />
          <h1 className="min-w-0 truncate text-xl font-semibold text-balance text-foreground">
            {i18n.t("translationHub.title")}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <section className="overflow-hidden rounded-xl bg-card shadow-control">
          <div className="grid grid-cols-1 border-b lg:grid-cols-2">
            <div className="border-b p-4 lg:border-r lg:border-b-0">
              <LanguageControlPanel />
            </div>
            <div className="flex items-center justify-end p-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <PromptSelector />
                <TranslationServiceDropdown />
                <TranslationPanelActions />
              </div>
            </div>
          </div>

          <div className="grid min-h-[calc(100vh-10rem)] grid-cols-1 lg:grid-cols-2">
            <div className="border-b p-4 lg:border-r lg:border-b-0">
              <TextInput />
            </div>
            <div className="bg-muted/20 p-4">
              <TranslationPanel />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
