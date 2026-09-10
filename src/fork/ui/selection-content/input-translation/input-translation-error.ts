import { i18n } from "@/utils/i18n"
import { getRequestErrorMeta } from "@/utils/request/retry-policy"

const HOSTED_REASONS = {
  authentication_required: "hostedAi.availability.authenticationRequired",
  ultra_required: "hostedAi.availability.ultraRequired",
  quota_exhausted: "hostedAi.availability.quotaExhausted",
  service_unavailable: "hostedAi.availability.serviceUnavailable",
} as const

export type InputTranslationError = {
  retryable: boolean
  messageKey:
    | (typeof HOSTED_REASONS)[keyof typeof HOSTED_REASONS]
    | "inputTranslationBar.failed"
    | "inputTranslationBar.contentBlocked"
    | "subtitles.errors.aiAuthFailed"
    | "options.selectionToolbar.customActions.form.selectProvider"
}

// Only inspect known error fields; never render/log a raw provider body or key.
// Errors crossing background messaging can lose Symbol metadata and prototypes.
function errorEvidence(error: unknown, depth = 0): string {
  if (depth > 4 || error === null || error === undefined) return ""
  if (typeof error === "string") return error.slice(0, 16000)
  if (typeof error !== "object") return ""
  const record = error as Record<string, unknown>
  return [
    "message",
    "code",
    "type",
    "unavailableReason",
    "responseBody",
    "body",
    "error",
    "data",
    "cause",
  ]
    .map((key) => errorEvidence(record[key], depth + 1))
    .join(" ")
}

export function classifyInputTranslationError(error: unknown): InputTranslationError {
  const evidence = errorEvidence(error)
  if (/\bUPSTREAM_CLOUD_DISABLED\b/.test(evidence)) {
    return {
      retryable: false,
      messageKey: "options.selectionToolbar.customActions.form.selectProvider",
    }
  }
  if (/\bdata_inspection_failed\b/i.test(evidence)) {
    return { retryable: false, messageKey: "inputTranslationBar.contentBlocked" }
  }

  const streamCodes = {
    HOSTED_AI_TIER_RESTRICTED: HOSTED_REASONS.ultra_required,
    HOSTED_AI_QUOTA_EXHAUSTED: HOSTED_REASONS.quota_exhausted,
    UNAUTHORIZED: HOSTED_REASONS.authentication_required,
  } as const
  for (const [code, messageKey] of Object.entries(streamCodes)) {
    if (new RegExp(`\\b${code}\\b`).test(evidence)) return { retryable: false, messageKey }
  }

  for (const [reason, messageKey] of Object.entries(HOSTED_REASONS)) {
    if (reason !== "service_unavailable" && new RegExp(`\\b${reason}\\b`).test(evidence)) {
      return { retryable: false, messageKey }
    }
  }

  if (error instanceof Error) {
    for (const [reason, messageKey] of Object.entries(HOSTED_REASONS)) {
      const prefix = i18n.t(messageKey)
      if (
        error.message === prefix ||
        (error.name === "HostedAiProviderUnavailableError" &&
          error.message.startsWith(`${prefix} · `))
      ) {
        return { retryable: reason === "service_unavailable", messageKey }
      }
    }
  }

  const { statusCode } = getRequestErrorMeta(error)
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    /\b(?:401|403|invalid_api_key|authentication_error)\b|invalid api key|incorrect api key/i.test(
      evidence,
    )
  ) {
    return { retryable: false, messageKey: "subtitles.errors.aiAuthFailed" }
  }
  return { retryable: true, messageKey: "inputTranslationBar.failed" }
}
