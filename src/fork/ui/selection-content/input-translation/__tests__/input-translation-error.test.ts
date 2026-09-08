import { describe, expect, it } from "vitest"
import { i18n } from "@/utils/i18n"
import { classifyInputTranslationError } from "../input-translation-error"

describe("input translation manual retry policy", () => {
  it.each([
    ["HOSTED_AI_TIER_RESTRICTED", "ultraRequired"],
    ["HOSTED_AI_QUOTA_EXHAUSTED", "quotaExhausted"],
    ["UNAUTHORIZED", "authenticationRequired"],
  ])("recognizes the actual background stream code %s even with HTTP 429", (code, key) => {
    expect(classifyInputTranslationError({ code, statusCode: 429 })).toEqual({
      retryable: false,
      messageKey: `hostedAi.availability.${key}`,
    })
  })

  it("recognizes a normalized hosted denial after custom fields are lost in transport", () => {
    expect(
      classifyInputTranslationError(new Error(i18n.t("hostedAi.availability.quotaExhausted"))),
    ).toMatchObject({ retryable: false })
  })
  it.each([
    new Error("Failed to fetch"),
    new Error("Request timeout"),
    { statusCode: 429 },
    { statusCode: 503 },
    new Error("unrecognized failure"),
    { statusCode: 400, isRetryable: false },
  ])("offers manual retry for temporary or unknown errors: %j", (error) => {
    expect(classifyInputTranslationError(error)).toMatchObject({ retryable: true })
  })

  it.each([
    { code: "data_inspection_failed", statusCode: 429 },
    { responseBody: '{"error":{"code":"data_inspection_failed"}}' },
    new Error("provider rejected: data_inspection_failed"),
    { cause: { code: "data_inspection_failed" } },
  ])("prioritizes content safety and never exposes the raw response", (error) => {
    expect(classifyInputTranslationError(error)).toEqual({
      retryable: false,
      messageKey: "inputTranslationBar.contentBlocked",
    })
  })

  it.each([
    ["authentication_required", "authenticationRequired"],
    ["ultra_required", "ultraRequired"],
    ["quota_exhausted", "quotaExhausted"],
  ])("does not retry the explicit hosted denial %s", (code, key) => {
    expect(classifyInputTranslationError({ code })).toEqual({
      retryable: false,
      messageKey: `hostedAi.availability.${key}`,
    })
  })

  it.each([
    ["authenticationRequired", false],
    ["ultraRequired", false],
    ["quotaExhausted", false],
    ["serviceUnavailable", true],
  ] as const)("recognizes serialized hosted %s with credit suffix", (reason, retryable) => {
    const error = new Error(`${i18n.t(`hostedAi.availability.${reason}`)} · 73%`)
    error.name = "HostedAiProviderUnavailableError"
    expect(classifyInputTranslationError(error).retryable).toBe(retryable)
  })

  it.each([{ statusCode: 401 }, { statusCode: 403 }, new Error("401 Unauthorized")])(
    "uses safe existing API-key copy for authentication failure",
    (error) => {
      expect(classifyInputTranslationError(error)).toMatchObject({ retryable: false })
    },
  )
})
