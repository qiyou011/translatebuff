import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import { FORK_BRANDING } from "@/fork/branding"
import { configAtom } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"

// fork 版 popup 参考页：只消费 atoms（读态）与既有导航/文案 helper，不直接读上游 zod schema。
// 完整 UI 重建为后续独立变更，本文件仅确立 app.tsx 壳层承载模式。
function App() {
  const config = useAtomValue(configAtom)

  return (
    <div className="flex min-w-64 flex-col gap-3 bg-background px-6 pt-5 pb-4">
      <span className="text-base font-semibold">{FORK_BRANDING.name}</span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {config ? "配置已加载" : "配置加载中"}
      </span>
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 self-start rounded-md px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        onClick={() => {
          void openOptionsPage()
        }}
      >
        <Icon icon="tabler:settings" className="size-4" strokeWidth={1.6} />
        <span className="text-[13px] font-medium">{i18n.t("popup.options")}</span>
      </button>
    </div>
  )
}

export default App
