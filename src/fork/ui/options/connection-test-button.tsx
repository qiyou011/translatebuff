import type { RenyimiaoProviderConfig } from "@/fork/providers/renyimiao"
import { IconCheck, IconHourglassLow, IconX } from "@tabler/icons-react"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import LoadingDots from "@/components/loading-dots"
import { Button } from "@/components/ui/base-ui/button"
import { getObjectWithoutAPIKeys } from "@/utils/config/api"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { i18n } from "@/utils/i18n"
import { getTranslatePrompt } from "@/utils/prompts/translate"

// fork 换皮版「测试连接」按钮：复刻陪读蛙 ConnectionTestButton 的能力——真发一次翻译探测网关，
// 复用上游逻辑 executeTranslate + getTranslatePrompt，base-ui Button 自绘，不引用上游 composed UI。
// idle → testing(LoadingDots) → success(绿勾)/slow(黄沙漏,>3s)/failed(红叉)，反馈 5s 后自动清除。

const SLOW_THRESHOLD_MS = 3_000
const FEEDBACK_DURATION_MS = 5_000

type Feedback = "success" | "slow" | "failed"

const FEEDBACK_ICON = {
  success: {
    Icon: IconCheck,
    container:
      "flex size-4 items-center justify-center rounded-full bg-green-200 dark:bg-green-800/50",
    icon: "size-3 text-green-700 dark:text-green-300 stroke-[2.5]",
  },
  slow: {
    Icon: IconHourglassLow,
    container:
      "flex size-4 items-center justify-center rounded-full bg-yellow-200 dark:bg-yellow-800/50",
    icon: "size-3 text-yellow-700 dark:text-yellow-300 stroke-[2.5]",
  },
  failed: {
    Icon: IconX,
    container: "flex size-4 items-center justify-center rounded-full bg-red-200 dark:bg-red-800/50",
    icon: "size-3 text-red-700 dark:text-red-300 stroke-[2.5]",
  },
} as const

const FEEDBACK_LABEL_KEY = {
  success: "options.apiProviders.testConnection.success",
  slow: "options.apiProviders.testConnection.slow",
  failed: "options.apiProviders.testConnection.failed",
} as const

function FeedbackIcon({ feedback }: { feedback: Feedback }) {
  const { Icon, container, icon } = FEEDBACK_ICON[feedback]
  return (
    <div aria-hidden="true" className={container}>
      <Icon className={icon} strokeWidth={2.5} />
    </div>
  )
}

export function ConnectionTestButton({
  providerConfig,
}: {
  providerConfig: RenyimiaoProviderConfig
}) {
  const { apiKey, baseURL } = providerConfig
  const customModel = providerConfig.model.customModel
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mutation = useMutation({
    // 不把 apiKey 放进 mutationKey（脱敏）
    mutationKey: ["renyimiaoConnection", getObjectWithoutAPIKeys(providerConfig)],
    mutationFn: () =>
      executeTranslate("Hi", DEFAULT_CONFIG.language, providerConfig, getTranslatePrompt),
  })

  const showFeedback = (next: Feedback) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setFeedback(next)
    timeoutRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS)
  }

  // 编辑 apiKey/baseURL/模型后清掉旧反馈，避免陈旧回显。
  useEffect(() => {
    setFeedback(null)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [apiKey, baseURL, customModel])

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  const handleTest = () => {
    const startedAt = Date.now()
    mutation.mutate(undefined, {
      onSuccess: () =>
        showFeedback(Date.now() - startedAt > SLOW_THRESHOLD_MS ? "slow" : "success"),
      onError: () => showFeedback("failed"),
    })
  }

  return (
    <Button
      size="xs"
      variant="outline"
      className="gap-2"
      onClick={handleTest}
      disabled={mutation.isPending || !apiKey}
    >
      {mutation.isPending ? (
        <>
          <LoadingDots className="scale-75" />
          <span className="text-xs">{i18n.t("options.apiProviders.testConnection.testing")}</span>
        </>
      ) : feedback ? (
        <>
          <FeedbackIcon feedback={feedback} />
          <span className="text-xs">{i18n.t(FEEDBACK_LABEL_KEY[feedback])}</span>
        </>
      ) : (
        <span className="text-xs">{i18n.t("options.apiProviders.testConnection.button")}</span>
      )}
    </Button>
  )
}
