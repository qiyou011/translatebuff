import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LanguageItem } from "@/components/language-combobox-options"
import { Combobox as Primitive } from "@base-ui/react"
import { useMemo } from "react"
import { filterLanguage, getTargetLanguageItems } from "@/components/language-combobox-options"
import { Button } from "@/components/ui/base-ui/button"
import {
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/base-ui/combobox"
import { SHARED_POPUP_CLOSED_STATE_CLASS } from "@/components/ui/base-ui/popup-animation-classes"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

interface InputTranslationLanguageSelectProps {
  value: LangCodeISO6393
  onValueChange: (value: LangCodeISO6393) => void
  container: HTMLElement
  onOpenChange: Primitive.Root.Props<LanguageItem<LangCodeISO6393>>["onOpenChange"]
  triggerClassName?: string
}

/** Only this surface owns the upward, editor-themed portal; shared menus stay upstream. */
export function InputTranslationLanguageSelect({
  value,
  onValueChange,
  container,
  onOpenChange,
  triggerClassName,
}: InputTranslationLanguageSelectProps) {
  const items = useMemo(() => getTargetLanguageItems(), [])
  return (
    <Primitive.Root<LanguageItem<LangCodeISO6393>>
      items={items}
      value={items.find((item) => item.value === value) ?? null}
      onValueChange={(item) => {
        if (item) onValueChange(item.value)
      }}
      filter={filterLanguage}
      autoHighlight
      onOpenChange={onOpenChange}
    >
      <ComboboxTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("w-auto min-w-0 justify-between font-normal", triggerClassName)}
          />
        }
      >
        <ComboboxValue>
          {(item: (typeof items)[number] | null) => (
            <span className="min-w-0 flex-1 truncate text-left">
              {item?.label ?? i18n.t("translationHub.searchLanguages")}
            </span>
          )}
        </ComboboxValue>
      </ComboboxTrigger>
      <Primitive.Portal container={container}>
        <Primitive.Positioner
          side="top"
          sideOffset={6}
          align="start"
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
          className="isolate z-2147483001"
        >
          <Primitive.Popup
            data-slot="combobox-content"
            className={cn(
              "rf-input-translation-menu group/combobox-content relative origin-(--transform-origin) overflow-hidden rounded-lg shadow-md ring-1 ring-foreground/10 duration-100 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              SHARED_POPUP_CLOSED_STATE_CLASS,
            )}
          >
            <ComboboxInput
              showTrigger={false}
              placeholder={i18n.t("translationHub.searchLanguages")}
            />
            <ComboboxList>
              {(item: (typeof items)[number]) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxList>
            <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
