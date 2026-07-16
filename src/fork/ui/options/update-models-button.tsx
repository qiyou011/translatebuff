import { Icon } from "@iconify/react"
import { useMutation } from "@tanstack/react-query"
import LoadingDots from "@/components/loading-dots"
import { Button } from "@/components/ui/base-ui/button"
import { extractErrorMessage } from "@/utils/error/extract-message"
import { i18n } from "@/utils/i18n"

// fork 换皮版「更新模型」按钮：复刻陪读蛙的 /models 拉取逻辑，但把结果整份回给选项页做实例集同步
// （而非 Combobox 选一个）。复用 extractErrorMessage + base-ui Button，不引用上游 composed UI。

interface ModelsResponse {
  data: Array<{ id: string }>
}

export function UpdateModelsButton({
  baseURL,
  apiKey,
  onModelsFetched,
  disabled,
}: {
  baseURL: string
  apiKey?: string
  onModelsFetched: (modelIds: string[]) => void
  disabled?: boolean
}) {
  const mutation = useMutation({
    mutationKey: ["renyimiaoFetchModels", baseURL],
    meta: { errorDescription: i18n.t("options.apiProviders.form.models.fetchError") },
    mutationFn: async () => {
      if (!apiKey) {
        throw new Error(i18n.t("options.apiProviders.form.models.apiKeyRequired"))
      }
      const response = await fetch(`${baseURL}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response))
      }
      const data: ModelsResponse = await response.json()
      return data.data.map((model) => model.id)
    },
  })

  const handleFetch = () => {
    if (!baseURL) {
      return
    }
    mutation.mutate(undefined, {
      onSuccess: (modelIds) => onModelsFetched(modelIds),
    })
  }

  if (mutation.isPending) {
    return (
      <Button type="button" variant="outline" size="xs" disabled>
        <LoadingDots className="scale-75" />
        {i18n.t("options.apiProviders.form.models.fetchModels")}
      </Button>
    )
  }

  if (mutation.isError) {
    return (
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={handleFetch}
        className="text-red-500 hover:text-red-500"
      >
        <Icon icon="tabler:alert-circle" className="size-3.5" />
        {i18n.t("options.apiProviders.form.models.clickToRetry")}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={handleFetch}
      disabled={disabled || !baseURL}
    >
      <Icon icon="tabler:refresh" className="size-3.5" />
      {mutation.isSuccess
        ? `已更新 ${mutation.data.length} 个模型`
        : i18n.t("options.apiProviders.form.models.fetchModels")}
    </Button>
  )
}
