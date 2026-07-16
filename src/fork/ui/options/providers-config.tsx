import type { RenyimiaoProviderConfig } from "@/fork/providers/renyimiao"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { ConfigCard } from "@/entrypoints/options/components/config-card"
import { EntityEditorLayout } from "@/entrypoints/options/components/entity-editor-layout"
import { EntityListRail } from "@/entrypoints/options/components/entity-list-rail"
import { FORK_BRANDING } from "@/fork/branding"
import {
  isRenyimiaoInstance,
  RENYIMIAO_GATEWAY_BASE_URL,
  renyimiaoApiKey,
  renyimiaoModelIds,
  setRenyimiaoApiKey,
  syncRenyimiaoModels,
} from "@/fork/providers/renyimiao"
import { useEnsureRenyimiaoSeeded } from "@/fork/providers/use-ensure-renyimiao-seeded"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { getProviderLogo } from "@/utils/providers/provider-display"
import { ConnectionTestButton } from "./connection-test-button"
import { UpdateModelsButton } from "./update-models-button"

// fork 换皮版选项页「API 提供商」：锁定为单个「任译喵 API」块——底层每模型一份实例，这里收成一块管理：
// 改 API Key 广播到全部实例、点「更新模型」fetch 网关 /models 重建实例集、模型清单只读展示、Base URL 只读。
// 复用通用布局(ConfigCard/EntityEditorLayout/EntityListRail) + base-ui 原语 + config atoms + fork 逻辑，
// 不 import 上游 providers-config/ProviderConfigForm。经 wxt.config resolve 插件全局替换上游 ProvidersConfig。

const RENYIMIAO_API_LABEL = `${FORK_BRANDING.displayName} API`

function RenyimiaoApiEditor({
  apiKey,
  modelIds,
  primaryInstance,
  onApiKeyChange,
  onModelsFetched,
}: {
  apiKey: string
  modelIds: string[]
  primaryInstance: RenyimiaoProviderConfig | null
  onApiKeyChange: (apiKey: string) => void
  onModelsFetched: (modelIds: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>API Key</FieldLabel>
          {primaryInstance && <ConnectionTestButton providerConfig={primaryInstance} />}
        </div>
        <Input
          type="password"
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder="粘贴你的任译喵 API Key"
        />
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>模型</FieldLabel>
          <UpdateModelsButton
            baseURL={RENYIMIAO_GATEWAY_BASE_URL}
            apiKey={apiKey}
            onModelsFetched={onModelsFetched}
          />
        </div>
        {modelIds.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
            {modelIds.map((modelId) => (
              <span key={modelId} className="truncate text-sm">
                {modelId}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">点「更新模型」从任译喵网关拉取可用模型</p>
        )}
      </Field>

      <Field>
        <FieldLabel>Base URL</FieldLabel>
        <Input value={RENYIMIAO_GATEWAY_BASE_URL} readOnly disabled />
      </Field>
    </div>
  )
}

export function ProvidersConfig() {
  const config = useAtomValue(configAtom)
  const [providersConfig, setProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const setConfig = useSetAtom(writeConfigAtom)
  const { theme } = useTheme()

  // 挂载时幂等 seed 任译喵（读 storage 最新值，post-init 避竞态）。
  useEnsureRenyimiaoSeeded()

  const apiKey = renyimiaoApiKey(providersConfig)
  const modelIds = renyimiaoModelIds(providersConfig)
  const primaryInstance =
    providersConfig.find(
      (provider): provider is RenyimiaoProviderConfig =>
        isRenyimiaoInstance(provider) && provider.provider === "openai-compatible",
    ) ?? null

  const handleApiKeyChange = (nextApiKey: string) => {
    void setProvidersConfig(setRenyimiaoApiKey(providersConfig, nextApiKey))
  }
  const handleModelsFetched = (fetchedModelIds: string[]) => {
    void setConfig(syncRenyimiaoModels(config, fetchedModelIds))
  }

  return (
    <ConfigCard
      id="api-providers"
      title={i18n.t("options.apiProviders.title")}
      description={i18n.t("options.apiProviders.description")}
      className="lg:flex-col"
    >
      <EntityEditorLayout
        list={
          <EntityListRail>
            <div className="flex items-center gap-2 rounded-lg border border-primary bg-muted px-3 py-2">
              <ProviderIcon
                logo={primaryInstance ? getProviderLogo(primaryInstance, theme) : ""}
                name={RENYIMIAO_API_LABEL}
                size="sm"
              />
            </div>
          </EntityListRail>
        }
        editor={
          <RenyimiaoApiEditor
            apiKey={apiKey}
            modelIds={modelIds}
            primaryInstance={primaryInstance}
            onApiKeyChange={handleApiKeyChange}
            onModelsFetched={handleModelsFetched}
          />
        }
      />
    </ConfigCard>
  )
}
