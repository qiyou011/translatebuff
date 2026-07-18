import { Icon } from "@iconify/react"
import { BrandMark } from "@/components/brand-mark"
import { AISmartContext } from "@/entrypoints/popup/components/ai-smart-context"
import { AlwaysTranslate } from "@/entrypoints/popup/components/always-translate"
import BlogNotification from "@/entrypoints/popup/components/blog-notification"
import LanguageOptionsSelector from "@/entrypoints/popup/components/language-options-selector"
import { MoreMenu } from "@/entrypoints/popup/components/more-menu"
import Hotkey from "@/entrypoints/popup/components/node-translation-hotkey-selector"
import { SiteControlToggle } from "@/entrypoints/popup/components/site-control-toggle"
import TranslateButton from "@/entrypoints/popup/components/translate-button"
import TranslatePromptSelector from "@/entrypoints/popup/components/translate-prompt-selector"
import { TranslationHubButton } from "@/entrypoints/popup/components/translation-hub-button"
import TranslationModeSelector from "@/entrypoints/popup/components/translation-mode-selector"
import { ForkAccountMenu } from "@/fork/ui/popup/account-menu"
import ProvidersField from "@/fork/ui/popup/providers-field"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"

// Translatebuff popup shell: keep the established compact settings patterns and fork version.
// 任译喵内置 provider 由 ProvidersField 挂载后幂等 seed，作为一项出现在选择器中；
// 其 key/模型走上游选项页原流程。
function App() {
  return (
    <>
      <div className="flex flex-col gap-2.5 bg-background px-4 pt-3 pb-3">
        <div className="flex items-center justify-between rounded-lg bg-card px-2 py-1.5">
          <ForkAccountMenu />
          <div className="flex items-center">
            <TranslationHubButton />
            <BlogNotification />
          </div>
        </div>
        <div className="flex animate-in flex-col gap-3 rounded-xl bg-card p-3 duration-300 fade-in slide-in-from-bottom-1">
          <LanguageOptionsSelector />
          <ProvidersField />
          <TranslatePromptSelector />
        </div>
        <div className="flex w-full animate-in items-center gap-2.5 duration-300 [animation-delay:60ms] fade-in slide-in-from-bottom-1">
          <TranslationModeSelector />
          <TranslateButton className="h-[52px] min-w-0 flex-1 rounded-lg bg-black px-6 text-base font-semibold text-white shadow-none hover:bg-zinc-900 active:translate-y-0 disabled:bg-black disabled:text-white disabled:opacity-45 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:disabled:bg-white dark:disabled:text-zinc-900" />
        </div>
        <div className="flex animate-in flex-col gap-1 rounded-xl bg-muted/75 px-3 py-1.5 duration-300 [animation-delay:120ms] fade-in slide-in-from-bottom-1 [&>*]:min-h-10 [&>*]:rounded-lg [&>*]:px-3 [&>*]:py-2">
          <SiteControlToggle />
          <AlwaysTranslate />
          <Hotkey />
          <AISmartContext />
        </div>
      </div>
      <div className="flex items-center justify-between bg-secondary/70 px-2.5 py-2">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          onClick={() => {
            void openOptionsPage()
          }}
        >
          <Icon icon="tabler:settings" className="size-4" strokeWidth={1.6} />
          <span className="text-sm font-medium">{i18n.t("popup.options")}</span>
        </button>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <BrandMark iconClassName="size-4 rounded" nameClassName="max-w-24 text-xs font-medium" />
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{EXTENSION_VERSION}</span>
        </span>
        <MoreMenu />
      </div>
    </>
  )
}

export default App
