import type { TranslationMode as TranslationModeType } from "@/types/config/translate"
import { deepmerge } from "deepmerge-ts"
import { useAtom, useAtomValue } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { ConfigCard } from "@/entrypoints/options/components/config-card"
import { canEnterTranslationOnlyMode } from "@/fork/providers/translation-only-gate"
import { TRANSLATION_MODES } from "@/types/config/translate"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"

// fork 版翻译模式卡片（换皮上游 options/pages/translation/translation-mode.tsx）：
// 上游版本对模式毫无门禁，切进「仅译文」后微软适配器会硬抛错、页面翻译整体失败。
//
// 两处上游契约不能动：具名导出 TranslationMode（translation/index.tsx 是具名导入）、
// ConfigCard 的 id="translation-mode"（options/command-palette/search-items.ts 靠它
// 定位设置项，改了不会报错、只会静默跳不过去）。

export function TranslationMode() {
  return (
    <ConfigCard
      id="translation-mode"
      title={i18n.t("options.translation.translationMode.title")}
      description={i18n.t("options.translation.translationMode.description")}
    >
      <TranslationModeSelector />
    </ConfigCard>
  )
}

function TranslationModeSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const config = useAtomValue(configAtom)
  const currentMode = translateConfig.mode
  const translationOnlyBlocked = !canEnterTranslationOnlyMode(config)

  const handleModeChange = (mode: TranslationModeType | null) => {
    if (!mode) return
    // 选项禁用只挡住鼠标；键盘选择与程序化调用仍要在写入前兜一次
    if (mode === "translationOnly" && translationOnlyBlocked) return

    void setTranslateConfig(deepmerge(translateConfig, { mode }))
  }

  return (
    <div className="flex w-full flex-col items-start gap-1.5 md:items-end">
      <Select value={currentMode} onValueChange={handleModeChange}>
        <SelectTrigger className="w-40">
          <SelectValue render={<span />}>
            {i18n.t(`options.translation.translationMode.mode.${currentMode}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TRANSLATION_MODES.map((mode) => (
              <SelectItem
                key={mode}
                value={mode}
                disabled={mode === "translationOnly" && translationOnlyBlocked}
              >
                {i18n.t(`options.translation.translationMode.mode.${mode}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {translationOnlyBlocked && (
        <p className="max-w-xs text-xs text-muted-foreground md:text-right">
          {i18n.t("options.translation.translationMode.microsoftNotSupported")}
        </p>
      )}
    </div>
  )
}
