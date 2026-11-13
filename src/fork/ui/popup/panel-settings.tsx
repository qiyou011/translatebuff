import { useAtom, useAtomValue } from "jotai"
import { getPageTranslatePromptSelectItems } from "@/components/prompt-configurator/built-in-prompts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Switch } from "@/components/ui/base-ui/switch"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { featureProviderRefAtom } from "@/utils/atoms/provider"
import { DEFAULT_TRANSLATE_PROMPT_ID } from "@/utils/constants/prompt"
import { i18n } from "@/utils/i18n"
import { canResolvedProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { getTranslationOnlyBlockedReason } from "@/utils/providers/translation-only-gate"
import { PanelIcon } from "./panel-icon"

export function PanelModeSelector() {
  const [page, setPage] = useAtom(configFieldsAtomMap.pageTranslation)
  const config = useAtomValue(configAtom)
  const blocked = getTranslationOnlyBlockedReason(config)
  const items = [
    { value: "bilingual", label: i18n.t("quickTranslation.bilingual") },
    { value: "translationOnly", label: i18n.t("quickTranslation.translationOnly") },
  ]
  return (
    <Select
      items={items}
      value={page.mode}
      onValueChange={(mode) => {
        if (mode === "bilingual" || (mode === "translationOnly" && !blocked)) void setPage({ mode })
      }}
    >
      <SelectTrigger
        className="tb-mode-selector"
        aria-label={i18n.t("quickTranslation.displayMode")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            disabled={item.value === "translationOnly" && !!blocked}
            title={item.value === "translationOnly" ? (blocked ?? undefined) : undefined}
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function PanelSmartSettings() {
  const [page, setPage] = useAtom(configFieldsAtomMap.pageTranslation)
  const provider = useAtomValue(featureProviderRefAtom("pageTranslation"))
  const available = !!provider && canResolvedProviderRefGenerateText(provider)
  const prompts = page.customPromptsConfig
  const items = getPageTranslatePromptSelectItems(prompts.patterns)
  return (
    <>
      <div className="tb-smart-row" data-unavailable={!available || undefined}>
        <span>
          {i18n.t("translatePrompt.title")}
          <span title={i18n.t("translatePrompt.description")}>
            <PanelIcon name="info" size={13} />
          </span>
        </span>
        <Select
          disabled={!available}
          items={items}
          value={prompts.promptId ?? DEFAULT_TRANSLATE_PROMPT_ID}
          onValueChange={(promptId) =>
            void setPage({
              customPromptsConfig: {
                ...prompts,
                promptId: promptId ?? DEFAULT_TRANSLATE_PROMPT_ID,
              },
            })
          }
        >
          <SelectTrigger className="tb-prompt-selector">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="tb-smart-row" data-unavailable={!available || undefined}>
        <span>
          {i18n.t("popup.aiSmartContext")}
          <span title={i18n.t("popup.aiSmartContextDescription")}>
            <PanelIcon name="info" size={13} />
          </span>
        </span>
        <Switch
          aria-label={i18n.t("popup.aiSmartContext")}
          disabled={!available}
          checked={available && page.enableAIContentAware}
          onCheckedChange={(enableAIContentAware) => void setPage({ enableAIContentAware })}
        />
      </div>
    </>
  )
}
