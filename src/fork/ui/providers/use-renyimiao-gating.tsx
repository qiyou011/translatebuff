import type { ProviderCapability } from "@/utils/providers/provider-registry"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { forkSessionAtom, useOpenForkLogin } from "@/fork/membership/atoms"
import { renyimiaoApiKey } from "@/fork/providers/renyimiao"
import { computeRenyimiaoGating } from "@/fork/ui/providers/renyimiao-gating"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"

// 宿主消费的 hook：读 providersConfig，按 capability 取可选 provider，套门禁纯逻辑。popup 与选项页共用。
export function useRenyimiaoGatedProviders(capability: ProviderCapability, selectedId: string) {
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  return useMemo(
    () =>
      computeRenyimiaoGating(
        getSelectableProvidersForCapability(capability, providersConfig),
        renyimiaoApiKey(providersConfig),
        selectedId,
      ),
    [providersConfig, capability, selectedId],
  )
}

// 门禁兜底 UI：未登录 → 登录引导；已登录待取 key（R6 窗口）→ 显获取中、不再引导登录。自取会话态与登录入口。
export function RenyimiaoGatedFallback() {
  const session = useAtomValue(forkSessionAtom)
  const openLogin = useOpenForkLogin()
  if (session) {
    return (
      <div className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground">
        正在获取任译喵模型…
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <span className="text-[13px] text-muted-foreground">登录后自动获取模型</span>
      <Button size="sm" variant="outline" onClick={openLogin}>
        {i18n.t("account.login")}
      </Button>
    </div>
  )
}
