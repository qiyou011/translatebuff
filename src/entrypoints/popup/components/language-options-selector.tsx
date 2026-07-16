import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LanguageItem } from "@/components/language-combobox-options"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { Icon } from "@iconify/react"
import { langCodeISO6393Schema } from "@read-frog/definitions"
import { IconChevronDown } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { filterLanguage } from "@/components/language-combobox-options"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/base-ui/combobox"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { detectedCodeAtom } from "@/utils/atoms/detected-code"
import { i18n } from "@/utils/i18n"
import { getLanguageLabel, getLanguageName } from "@/utils/language-labels"

function createLanguageItem(code: LangCodeISO6393): LanguageItem<LangCodeISO6393> {
  return {
    value: code,
    label: getLanguageLabel(code),
    name: getLanguageName(code),
  }
}

const langSelectorTriggerClasses =
  "!h-12 w-[145px] justify-between gap-2 rounded-lg border-0 bg-muted/70 px-3 shadow-none hover:bg-muted"

const langSelectorContentClasses = "flex min-w-0 flex-1 items-center text-base font-medium"

function LanguageComboboxTrigger({ label, ariaLabel }: { label: string; ariaLabel: string }) {
  return (
    <ComboboxPrimitive.Trigger
      render={
        <Button
          type="button"
          variant="outline"
          className={langSelectorTriggerClasses}
          aria-label={ariaLabel}
          title={label}
        />
      }
    >
      <div className={langSelectorContentClasses}>
        <span className="w-full truncate text-left">{label}</span>
      </div>
      <IconChevronDown className="size-4 text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
}

export default function LanguageOptionsSelector() {
  const [language, setLanguage] = useAtom(configFieldsAtomMap.language)
  const detectedCode = useAtomValue(detectedCodeAtom)
  const targetLanguageItems = useMemo(
    () => langCodeISO6393Schema.options.map(createLanguageItem),
    [],
  )
  const sourceLanguageItems = useMemo<LanguageItem[]>(
    () => [
      {
        value: "auto",
        label: getLanguageLabel(detectedCode),
        name: getLanguageName(detectedCode),
      },
      ...targetLanguageItems,
    ],
    [detectedCode, targetLanguageItems],
  )
  const currentSourceItem = useMemo(
    () =>
      sourceLanguageItems.find((item) => item.value === language.sourceCode) ??
      sourceLanguageItems[0] ??
      null,
    [language.sourceCode, sourceLanguageItems],
  )
  const currentTargetItem = useMemo(
    () => targetLanguageItems.find((item) => item.value === language.targetCode) ?? null,
    [language.targetCode, targetLanguageItems],
  )

  const handleSourceLangChange = (item: LanguageItem | null) => {
    if (!item || item.value === language.sourceCode) return
    void setLanguage({ sourceCode: item.value })
  }

  const handleTargetLangChange = (item: LanguageItem | null) => {
    if (!item || item.value === "auto" || item.value === language.targetCode) return
    void setLanguage({ targetCode: item.value })
  }

  const sourceLangLabel =
    language.sourceCode === "auto"
      ? `${i18n.t("popup.autoLang")} · ${currentSourceItem?.label ?? getLanguageLabel(detectedCode)}`
      : (currentSourceItem?.label ?? getLanguageLabel(language.sourceCode))

  const targetLangLabel = currentTargetItem?.label ?? getLanguageLabel(language.targetCode)

  return (
    <div className="flex items-center justify-between gap-2">
      <Combobox
        value={currentSourceItem}
        onValueChange={handleSourceLangChange}
        items={sourceLanguageItems}
        filter={filterLanguage}
        autoHighlight
      >
        <LanguageComboboxTrigger label={sourceLangLabel} ariaLabel={i18n.t("popup.sourceLang")} />
        <ComboboxContent className="w-72 rounded-lg shadow-md">
          <ComboboxInput
            showTrigger={false}
            placeholder={i18n.t("translationHub.searchLanguages")}
          />
          <ComboboxList>
            {(item: LanguageItem) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
                {item.value === "auto" && <AutoLangCell />}
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
      <Icon
        icon="tabler:arrow-right"
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
      />
      <Combobox
        value={currentTargetItem}
        onValueChange={handleTargetLangChange}
        items={targetLanguageItems}
        filter={filterLanguage}
        autoHighlight
      >
        <LanguageComboboxTrigger label={targetLangLabel} ariaLabel={i18n.t("popup.targetLang")} />
        <ComboboxContent className="w-72 rounded-lg shadow-md">
          <ComboboxInput
            showTrigger={false}
            placeholder={i18n.t("translationHub.searchLanguages")}
          />
          <ComboboxList>
            {(item: LanguageItem<LangCodeISO6393>) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

function AutoLangCell() {
  return (
    <span className="flex items-center rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800">
      auto
    </span>
  )
}
