import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { TranslationFeature } from "@/fork/config/feature-config"
import type { FeatureConfigPatch } from "@/fork/config/types"
import { Icon } from "@iconify/react"
import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import { LanguageCombobox } from "@/components/language-combobox"
import { getTargetLanguageItems } from "@/components/language-combobox-options"
import { Switch } from "@/components/ui/base-ui/switch"
import { ThresholdInput } from "@/entrypoints/options/pages/input-translation/trigger"
import ForkProviderSelector from "@/fork/components/provider-selector"
import {
  featureConfigAtom,
  featureConfigLoadFailedAtom,
  writeFeatureConfigAtom,
} from "@/fork/config/atoms"
import { currentEdition } from "@/fork/identity/edition"
import { useEnsureRenyimiaoSeeded } from "@/fork/providers/use-ensure-renyimiao-seeded"
import { PanelIcon } from "@/fork/ui/popup/panel-icon"
import { SupportedPlatformIcons } from "@/fork/ui/popup/quick-panel-tutorial"
import {
  RenyimiaoGatedFallback,
  useRenyimiaoGatedProviders,
} from "@/fork/ui/providers/use-renyimiao-gating"
import {
  FEATURE_PROVIDER_DEFS,
  buildFeatureProviderPatch,
} from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { getLanguageName } from "@/utils/language-labels"
import { isSystemProviderSelectorItem } from "@/utils/providers/provider-display"
import { canResolvedProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { providerSupportsTranslationOnlyMode } from "@/utils/providers/translation-only-gate"
import "./options/input-settings.css"

export const FEATURE_ROUTES = {
  page: "/page-translation",
  selection: "/selection-toolbar",
  input: "/input-translation",
  subtitles: "/video-subtitles",
} as const
export const FEATURE_LABELS = {
  page: "options.translation.title",
  selection: "quickTranslation.selectionTitle",
  input: "options.inputTranslation.title",
  subtitles: "options.videoSubtitles.title",
} as const
const featureKeys = {
  page: "pageTranslation",
  selection: "selectionTranslation",
  input: "inputTranslation",
  subtitles: "videoSubtitles",
} as const

export function FeatureSettings({
  feature,
  languagesOnly = false,
  showEnabled = true,
  compact = false,
}: {
  feature: TranslationFeature
  languagesOnly?: boolean
  showEnabled?: boolean
  compact?: boolean
}) {
  const snapshot = useAtomValue(featureConfigAtom)
  const loadFailed = useAtomValue(featureConfigLoadFailedAtom)
  const write = useSetAtom(writeFeatureConfigAtom)
  const [failed, setFailed] = useState(false)
  useEnsureRenyimiaoSeeded()
  const featureKey = featureKeys[feature]
  const providerId = snapshot
    ? FEATURE_PROVIDER_DEFS[featureKey].getProviderId(snapshot.mainConfig)
    : ""
  const { providers, showFallback } = useRenyimiaoGatedProviders(featureKey, providerId)
  if (!snapshot) {
    return loadFailed ? (
      <p role="alert">{i18n.t("quickTranslation.loadFailed")}</p>
    ) : (
      <p role="status">{i18n.t("quickTranslation.loading")}</p>
    )
  }
  const { mainConfig: main, forkConfig: fork } = snapshot
  const provider = resolveProviderRefForCapability(featureKey, main.providersConfig, providerId)
  const contextAvailable = !!provider && canResolvedProviderRefGenerateText(provider)
  const disabledProviderIds =
    feature === "page" && main.pageTranslation.mode === "translationOnly"
      ? providers
          .filter(
            (item) =>
              !isSystemProviderSelectorItem(item) &&
              !providerSupportsTranslationOnlyMode(item.provider),
          )
          .map((item) => item.id)
      : undefined
  const save = (patch: Omit<FeatureConfigPatch, "expectedRevision">) => {
    setFailed(false)
    void write(patch).catch(() => setFailed(true))
  }
  const inputTarget = main.inputTranslation.toLang
  const language =
    feature === "page"
      ? main.language
      : feature === "input"
        ? {
            sourceCode: "auto" as const,
            targetCode:
              inputTarget === "sourceCode" || inputTarget === "targetCode"
                ? main.language.targetCode
                : inputTarget,
          }
        : fork.featureLanguages[feature]
  const setLanguage = (field: "sourceCode" | "targetCode", value: LangCodeISO6393 | "auto") => {
    if (field === "targetCode" && value === "auto") return
    if (feature === "input") {
      if (value !== "auto") save({ main: { inputTranslation: { toLang: value } } })
    } else if (feature === "page") {
      save({ main: { language: { [field]: value } } })
    } else {
      save({ fork: { featureLanguages: { [feature]: { [field]: value } } } })
    }
  }
  const enabled =
    feature === "input"
      ? main.inputTranslation.enabled
      : feature === "subtitles"
        ? main.videoSubtitles.enabled
        : main.selectionToolbar.features.translate.enabled
  const setEnabled = (value: boolean) =>
    save({
      main:
        feature === "input"
          ? { inputTranslation: { enabled: value } }
          : feature === "subtitles"
            ? { videoSubtitles: { enabled: value } }
            : { selectionToolbar: { features: { translate: { enabled: value } } } },
    })
  if (compact) {
    const targets = getTargetLanguageItems().map((item) => ({
      ...item,
      label: getLanguageName(item.value),
    }))
    const sources = [
      { value: "auto" as const, label: i18n.t("quickTranslation.autoDetect") },
      ...targets,
    ]
    return (
      <div className="tb-feature-settings" data-feature-settings={feature}>
        {failed && <p role="alert">{i18n.t("quickTranslation.saveFailed")}</p>}
        <div className="tb-language-row">
          {feature === "input" ? (
            <span className="tb-fixed-language">{i18n.t("quickTranslation.autoDetect")}</span>
          ) : (
            <LanguageCombobox
              items={sources}
              value={language.sourceCode}
              onValueChange={(value) => setLanguage("sourceCode", value)}
              autoLabel={i18n.t("quickTranslation.autoDetect")}
              triggerSize="sm"
            />
          )}
          <PanelIcon name="arrow" />
          <LanguageCombobox
            items={targets}
            value={language.targetCode}
            onValueChange={(value) => setLanguage("targetCode", value)}
            triggerSize="sm"
          />
        </div>
        <div className="tb-provider-row" data-provider={providerId}>
          {showFallback ? (
            <RenyimiaoGatedFallback />
          ) : (
            <ForkProviderSelector
              providers={providers}
              disabledProviderIds={disabledProviderIds}
              value={providerId}
              onChange={(id) => save({ main: buildFeatureProviderPatch({ [featureKey]: id }) })}
              triggerSize="sm"
              selectContentProps={{ positionerClassName: "tb-provider-menu-positioner" }}
            />
          )}
        </div>
        {feature === "input" && (
          <label className="tb-context-row" data-unavailable={!contextAvailable || undefined}>
            <span>
              {i18n.t("quickTranslation.smartContext")}
              <span title={i18n.t("popup.aiSmartContextDescription")}>
                <PanelIcon name="info" size={12} />
              </span>
            </span>
            <Switch
              aria-label={i18n.t("quickTranslation.smartContext")}
              disabled={!contextAvailable}
              checked={contextAvailable && main.pageTranslation.enableAIContentAware}
              onCheckedChange={(value) =>
                save({ main: { pageTranslation: { enableAIContentAware: value } } })
              }
            />
          </label>
        )}
        {feature === "subtitles" && (
          <label className="tb-context-row">
            <span>{i18n.t("quickTranslation.enableSubtitles")}</span>
            <Switch
              aria-label={i18n.t("quickTranslation.enabled")}
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </label>
        )}
      </div>
    )
  }
  if (feature === "input" && !languagesOnly) {
    return (
      <div className="tb-input-settings" data-feature-settings={feature}>
        {failed && <p role="alert">{i18n.t("quickTranslation.saveFailed")}</p>}
        <section className="tb-supported-platforms">
          <h2>{i18n.t("quickTranslation.supportedContextPlatforms")}</h2>
          <p>{i18n.t("quickTranslation.supportedContextDescription")}</p>
          <SupportedPlatformIcons />
        </section>
        <h2>{i18n.t("options.inputTranslation.trigger.title")}</h2>
        {showEnabled && (
          <label className="tb-input-setting-row">
            <span>
              <strong>{i18n.t("options.inputTranslation.trigger.enable.title")}</strong>
              <span>
                {i18n.t("inputTranslationBar.triggerHintCount", [
                  fork.inputTranslation.triggerCount,
                ])}
              </span>
            </span>
            <Switch
              aria-label={i18n.t("quickTranslation.enabled")}
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </label>
        )}
        <label className="tb-input-setting-row">
          <span>
            <strong>{i18n.t("quickTranslation.triggerKey")}</strong>
            <span>{i18n.t("quickTranslation.triggerKeyDescription")}</span>
          </span>
          <input
            aria-label={i18n.t("quickTranslation.triggerKey")}
            value={i18n.t("quickTranslation.spaceKey")}
            readOnly
          />
        </label>
        <label className="tb-input-setting-row">
          <span>
            <strong>{i18n.t("quickTranslation.triggerCount")}</strong>
            <span>{i18n.t("quickTranslation.triggerCountDescription")}</span>
          </span>
          <select
            aria-label={i18n.t("quickTranslation.triggerCount")}
            value={fork.inputTranslation.triggerCount}
            onChange={(event) =>
              save({ fork: { inputTranslation: { triggerCount: Number(event.target.value) } } })
            }
          >
            {[2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                {i18n.t("quickTranslation.spaceCount", [count])}
              </option>
            ))}
          </select>
        </label>
        <label className="tb-input-setting-row">
          <span>
            <strong>{i18n.t("options.inputTranslation.trigger.threshold.title")}</strong>
            <span>{i18n.t("options.inputTranslation.trigger.threshold.description")}</span>
          </span>
          <ThresholdInput
            value={main.inputTranslation.timeThreshold}
            onValue={(timeThreshold) => save({ main: { inputTranslation: { timeThreshold } } })}
          />
        </label>
        <h2>{i18n.t("options.inputTranslation.languages.title")}</h2>
        <section className="tb-input-language-card">
          <h3>{i18n.t("quickTranslation.languageDirection")}</h3>
          <p>{i18n.t("quickTranslation.languageDirectionDescription")}</p>
          <div className="tb-input-language-controls">
            <span>{i18n.t("quickTranslation.autoDetect")}</span>
            <PanelIcon name="arrow" size={20} />
            <LanguageCombobox
              items={getTargetLanguageItems()}
              value={language.targetCode}
              onValueChange={(value) => setLanguage("targetCode", value)}
            />
          </div>
        </section>
        <div className="tb-input-setting-row">
          <span>
            <strong>{i18n.t("quickTranslation.provider")}</strong>
          </span>
          {showFallback ? (
            <RenyimiaoGatedFallback />
          ) : (
            <ForkProviderSelector
              providers={providers}
              value={providerId}
              onChange={(id) => save({ main: buildFeatureProviderPatch({ [featureKey]: id }) })}
            />
          )}
        </div>
        <label className="tb-input-setting-row">
          <span>
            <strong>{i18n.t("quickTranslation.smartContext")}</strong>
          </span>
          <Switch
            aria-label={i18n.t("quickTranslation.smartContext")}
            disabled={!contextAvailable}
            checked={contextAvailable && main.pageTranslation.enableAIContentAware}
            onCheckedChange={(value) =>
              save({ main: { pageTranslation: { enableAIContentAware: value } } })
            }
          />
        </label>
        {currentEdition() === "cn" && (
          <p className="tb-input-platform-notice">{i18n.t("quickTranslation.platformNotice")}</p>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4" data-feature-settings={feature}>
      {failed && <p role="alert">{i18n.t("quickTranslation.saveFailed")}</p>}
      {!languagesOnly && showEnabled && feature !== "page" && (
        <label className="flex items-center justify-between gap-3">
          <span>{i18n.t("quickTranslation.enabled")}</span>
          <Switch
            aria-label={i18n.t("quickTranslation.enabled")}
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm">{i18n.t("side.sourceLang")}</span>
          {feature === "input" ? (
            <span className="rounded-md border p-2 text-sm">
              {i18n.t("quickTranslation.autoDraft")}
            </span>
          ) : (
            <LanguageCombobox
              value={language.sourceCode}
              onValueChange={(value) => setLanguage("sourceCode", value)}
              autoLabel={i18n.t("quickTranslation.autoDetect")}
              triggerSize="sm"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm">{i18n.t("side.targetLang")}</span>
          <LanguageCombobox
            items={getTargetLanguageItems()}
            value={language.targetCode}
            onValueChange={(value) => setLanguage("targetCode", value)}
            triggerSize="sm"
          />
        </div>
      </div>
      {!languagesOnly && (
        <div className="flex flex-col gap-2">
          <span className="text-sm">{i18n.t("quickTranslation.provider")}</span>
          {showFallback ? (
            <RenyimiaoGatedFallback />
          ) : (
            <ForkProviderSelector
              providers={providers}
              disabledProviderIds={disabledProviderIds}
              value={providerId}
              onChange={(id) => save({ main: buildFeatureProviderPatch({ [featureKey]: id }) })}
              triggerSize="sm"
            />
          )}
        </div>
      )}
      {!languagesOnly && (feature === "input" || feature === "subtitles") && (
        <>
          <div className="flex -space-x-1">
            {(feature === "input"
              ? ["Discord", "Telegram", "YouTube", "X", "WhatsApp", "Reddit"]
              : ["YouTube", "X", "Netflix"]
            ).map((name) => (
              <span key={name} title={name} className="rounded-full border bg-background p-2">
                <Icon
                  icon={`simple-icons:${name.toLowerCase()}`}
                  role="img"
                  aria-label={name}
                  className="size-5"
                />
              </span>
            ))}
          </div>
          {currentEdition() === "cn" && (
            <p className="text-xs text-muted-foreground">
              {i18n.t("quickTranslation.platformNotice")}
            </p>
          )}
        </>
      )}
      {!languagesOnly && feature === "input" && (
        <>
          <label className="flex items-center justify-between gap-3">
            <span>{i18n.t("quickTranslation.triggerCount")}</span>
            <select
              aria-label={i18n.t("quickTranslation.triggerCount")}
              className="rounded-md border bg-background p-2"
              value={fork.inputTranslation.triggerCount}
              onChange={(event) =>
                save({ fork: { inputTranslation: { triggerCount: Number(event.target.value) } } })
              }
            >
              {[2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>{i18n.t("options.inputTranslation.trigger.threshold.title")}</span>
            <ThresholdInput
              value={main.inputTranslation.timeThreshold}
              onValue={(timeThreshold) => save({ main: { inputTranslation: { timeThreshold } } })}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            {i18n.t("inputTranslationBar.triggerHintCount", [fork.inputTranslation.triggerCount])}
          </p>
          <label className="flex items-center justify-between gap-3">
            <span>{i18n.t("quickTranslation.smartContext")}</span>
            <Switch
              aria-label={i18n.t("quickTranslation.smartContext")}
              disabled={!contextAvailable}
              checked={contextAvailable && main.pageTranslation.enableAIContentAware}
              onCheckedChange={(value) =>
                save({ main: { pageTranslation: { enableAIContentAware: value } } })
              }
            />
          </label>
        </>
      )}
    </div>
  )
}
