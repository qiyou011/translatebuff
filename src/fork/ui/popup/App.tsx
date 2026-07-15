import { Icon } from "@iconify/react"
import { UserAccountMenuPopup } from "@/components/user-account-menu"
import { AISmartContext } from "@/entrypoints/popup/components/ai-smart-context"
import { AlwaysTranslate } from "@/entrypoints/popup/components/always-translate"
import BlogNotification from "@/entrypoints/popup/components/blog-notification"
import { DiscordButton } from "@/entrypoints/popup/components/discord-button"
import LanguageOptionsSelector from "@/entrypoints/popup/components/language-options-selector"
import { MoreMenu } from "@/entrypoints/popup/components/more-menu"
import Hotkey from "@/entrypoints/popup/components/node-translation-hotkey-selector"
import ProvidersField from "@/entrypoints/popup/components/providers-field"
import { SiteControlToggle } from "@/entrypoints/popup/components/site-control-toggle"
import TranslateButton from "@/entrypoints/popup/components/translate-button"
import TranslatePromptSelector from "@/entrypoints/popup/components/translate-prompt-selector"
import { TranslationHubButton } from "@/entrypoints/popup/components/translation-hub-button"
import TranslationModeSelector from "@/entrypoints/popup/components/translation-mode-selector"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"

// fork 版 popup：沿用上游（陪读蛙）完整面板与组件、布局照旧，仅 footer 版本号取 fork 的 0.0.x。
// 任译喵内置 provider 由后台 setupFork 统一 seed，作为一项出现在 ProvidersField 的选择中；
// 其 key/模型走上游选项页原流程。
function App() {
  return (
    <>
      <div className="flex flex-col gap-4 bg-background px-6 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <UserAccountMenuPopup />
          <div className="flex items-center">
            <TranslationHubButton />
            <DiscordButton />
            <BlogNotification />
          </div>
        </div>
        <LanguageOptionsSelector />
        <ProvidersField />
        <TranslatePromptSelector />
        <div className="flex w-full items-center gap-2">
          <TranslationModeSelector />
          <TranslateButton className="min-w-0 flex-1" />
        </div>
        <SiteControlToggle />
        <AlwaysTranslate />
        <Hotkey />
        <AISmartContext />
      </div>
      <div className="flex items-center justify-between bg-neutral-200 px-2 py-1 dark:bg-neutral-800">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          onClick={() => {
            void openOptionsPage()
          }}
        >
          <Icon icon="tabler:settings" className="size-4" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">{i18n.t("popup.options")}</span>
        </button>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{EXTENSION_VERSION}</span>
        <MoreMenu />
      </div>
    </>
  )
}

export default App
