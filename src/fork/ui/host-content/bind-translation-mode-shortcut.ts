import type { Hotkey } from "@tanstack/hotkeys"
import type { TranslationMode } from "@/types/config/translate"
import { HotkeyManager } from "@tanstack/hotkeys"
import { toastManager } from "@/components/ui/base-ui/toast"
import { canEnterTranslationOnlyMode } from "@/fork/providers/translation-only-gate"
import { getLocalConfig, setLocalConfig } from "@/utils/config/storage"
import { i18n } from "@/utils/i18n"
import {
  isPageTranslationShortcutEmpty,
  isValidConfiguredPageTranslationShortcut,
} from "@/utils/page-translation-shortcut"

// fork 版模式切换快捷键（换皮上游 host.content/translation-control/bind-translation-mode-shortcut）：
// 快捷键是 config.translate.mode 的三个写入口之一，微软激活时必须拦住「进入仅译文」。
// 具名导出 bindTranslationModeShortcutKey 不能改——上游 host.content/runtime.ts 是具名导入。

const NEXT_MODE: Record<TranslationMode, TranslationMode> = {
  bilingual: "translationOnly",
  translationOnly: "bilingual",
}

export async function bindTranslationModeShortcutKey() {
  const config = await getLocalConfig()
  if (!config || isPageTranslationShortcutEmpty(config.translate.modeShortcut)) {
    return () => {}
  }

  const shortcut = config.translate.modeShortcut
  if (!isValidConfiguredPageTranslationShortcut(shortcut)) {
    return () => {}
  }

  const registration = HotkeyManager.getInstance().register(
    shortcut as Hotkey,
    async () => {
      const currentConfig = await getLocalConfig()
      if (!currentConfig) return

      const currentMode = currentConfig.translate.mode
      const nextMode = NEXT_MODE[currentMode]

      // 网页翻译 provider 不支持保留标记时（见 translation-only-gate），不切模式，
      // 改为把原因说出来——静默不响应会让用户以为快捷键坏了。
      if (nextMode === "translationOnly" && !canEnterTranslationOnlyMode(currentConfig)) {
        toastManager.add({
          type: "info",
          title: i18n.t("options.translation.translationMode.microsoftNotSupported"),
        })
        return
      }

      await setLocalConfig({
        ...currentConfig,
        translate: {
          ...currentConfig.translate,
          mode: nextMode,
        },
      })

      const modeName = i18n.t(`options.translation.translationMode.mode.${nextMode}`)
      toastManager.add({
        type: "info",
        title: i18n.t("options.translation.translationModeShortcut.switched", [modeName]),
      })
    },
    {
      ignoreInputs: true,
      preventDefault: true,
      stopPropagation: true,
    },
  )

  return () => {
    registration.unregister()
  }
}
