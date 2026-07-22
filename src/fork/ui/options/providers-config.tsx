import type { ForkSession } from "@/fork/membership/session"
import type { RenyimiaoProviderConfig } from "@/fork/providers/renyimiao"
import { useAtomValue, useSetAtom } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { ConfigCard } from "@/entrypoints/options/components/config-card"
import { FORK_BRANDING } from "@/fork/branding"
import { useForkSession, useOpenForkLogin } from "@/fork/membership/atoms"
import {
  isRenyimiaoInstance,
  RENYIMIAO_GATEWAY_BASE_URL,
  renyimiaoApiKey,
  renyimiaoBaseUrl,
  renyimiaoModelIds,
  syncRenyimiaoModels,
} from "@/fork/providers/renyimiao"
import { useEnsureRenyimiaoSeeded } from "@/fork/providers/use-ensure-renyimiao-seeded"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConnectionTestButton } from "./connection-test-button"
import { UpdateModelsButton } from "./update-models-button"

// fork 换皮版选项页「API 提供商」：锁定为单个「任译喵 API」块——底层每模型一份实例，这里收成一块管理：
// API Key 由登录单写（后台唯一写者注入），设置页只读掩码展示、无手填写入路径（消除并发写覆盖）；
// 未登录显「登录后自动获取」并引导登录。点「更新模型」fetch 网关 /models 重建实例集、模型清单只读、Base URL 只读。
// 复用通用布局(ConfigCard/EntityEditorLayout/EntityListRail) + base-ui 原语 + config atoms + fork 逻辑，
// 不 import 上游 providers-config/ProviderConfigForm。经 wxt.config resolve 插件全局替换上游 ProvidersConfig。

const RENYIMIAO_API_LABEL = `${FORK_BRANDING.displayName} API`

function RenyimiaoApiEditor({
  apiKey,
  baseUrl,
  modelIds,
  primaryInstance,
  session,
  onLogin,
  onModelsFetched,
}: {
  apiKey: string
  baseUrl: string
  modelIds: string[]
  primaryInstance: RenyimiaoProviderConfig | null
  session: ForkSession | null
  onLogin: () => void
  onModelsFetched: (modelIds: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>API Key</FieldLabel>
          {session && apiKey && primaryInstance && (
            <ConnectionTestButton providerConfig={primaryInstance} />
          )}
        </div>
        {/* 以登录态为准（未登录即便残留 stale key 也引导登录）：登录且已注入 → 只读掩码；登录待取 → 获取中；未登录 → 引导登录。 */}
        {!session ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-muted-foreground">登录后自动获取</span>
            <Button size="sm" variant="outline" onClick={onLogin}>
              {i18n.t("account.login")}
            </Button>
          </div>
        ) : apiKey ? (
          // 登录单写、设置页只读掩码：值唯一来源为后台注入，无手填写入路径（消除并发写覆盖）。
          <Input type="password" value={apiKey} readOnly disabled />
        ) : (
          <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
            正在获取任译喵密钥…
          </div>
        )}
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>模型</FieldLabel>
          <UpdateModelsButton baseURL={baseUrl} apiKey={apiKey} onModelsFetched={onModelsFetched} />
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
        <Input value={baseUrl} readOnly disabled />
      </Field>
    </div>
  )
}

export function ProvidersConfig() {
  const config = useAtomValue(configAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const setConfig = useSetAtom(writeConfigAtom)

  // 挂载时幂等 seed 任译喵（读 storage 最新值，post-init 避竞态）。
  useEnsureRenyimiaoSeeded()
  // 会话响应式 + 挂载对账（R6：已登录但 key 空 → 补拉）。登录入口按界面语言跳官网。
  const session = useForkSession()
  const openLogin = useOpenForkLogin()

  const apiKey = renyimiaoApiKey(providersConfig)
  // 动态网关地址：登录后由 /v1/tokens 写入实例；未登录/缺失回落网关常量。
  const baseUrl = renyimiaoBaseUrl(providersConfig) || RENYIMIAO_GATEWAY_BASE_URL
  const modelIds = renyimiaoModelIds(providersConfig)
  const primaryInstance =
    providersConfig.find(
      (provider): provider is RenyimiaoProviderConfig =>
        isRenyimiaoInstance(provider) && provider.provider === "openai-compatible",
    ) ?? null

  const handleModelsFetched = (fetchedModelIds: string[]) => {
    void setConfig(syncRenyimiaoModels(config, fetchedModelIds))
  }

  // 单一「任译喵 API」provider，无需实体列表侧栏（设计冗余），编辑器直接铺满内容区。
  return (
    <ConfigCard
      id="api-providers"
      title={RENYIMIAO_API_LABEL}
      description="用于翻译和词汇解析功能"
      className="lg:flex-col"
    >
      <RenyimiaoApiEditor
        apiKey={apiKey}
        baseUrl={baseUrl}
        modelIds={modelIds}
        primaryInstance={primaryInstance}
        session={session}
        onLogin={openLogin}
        onModelsFetched={handleModelsFetched}
      />
    </ConfigCard>
  )
}
